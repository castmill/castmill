defmodule Castmill.Widgets.Packages do
  @moduledoc """
  Installs the widget packages network admins upload (`widget.json`, or a ZIP with
  `widget.json` and `assets/`, see `Castmill.Widgets.PackageProcessor`) as widgets
  of their network, without a deploy.

    * The server decides the scope; scope fields in the package are ignored. A new
      widget starts hidden in Widget Access until the admin chooses who can use it.
    * Uploading a package with the slug of one of the network's widgets updates it
      and keeps its access. Widgets of other networks and organizations, system
      widgets and widgets the platform manages (`meta.managed_by`, e.g. installed
      at deploy) cannot be replaced.
    * A declared integration (`integration`, or `meta.integration`) must use an
      installed fetcher (packages never bring code) and can't set the fetcher
      module or an endpoint in its config. It is created or updated with the
      widget, so the organization settings it declares can be configured before
      the widget is used. A new version can't rename or remove it.
    * An update that would make saved playlist items invalid (e.g. a new required
      option without a default, or a shorter editable text) is refused. It is
      checked under the widget's row lock, which playlist insertions and config
      edits share. The upload endpoint then notifies the playlists using it.
    * Assets are stored in public storage under content-hash keys, and
      `{{asset:category.name}}` placeholders are replaced with their URLs. Assets
      no kept version uses are deleted (refused uploads, old versions, deleted
      widgets). Storing, installing and deleting assets of a slug take a lock on
      the slug, so they never race.
    * Every upload is kept as a version (the last 10), to download or reinstall.
  """
  import Ecto.Query, only: [from: 2]

  require Logger

  alias Castmill.Repo
  alias Castmill.Widgets
  alias Castmill.Widgets.{AssetStorage, NetworkAccess, PackageProcessor, Schema}
  alias Castmill.Widgets.{TextOverrides, Widget, WidgetConfig, WidgetPackage}
  alias Castmill.Widgets.Integrations
  alias Castmill.Widgets.Integrations.WidgetIntegration

  @kept_versions 10
  @max_package_size 10 * 1024 * 1024
  @scope_fields ["is_system", "network_id", "organization_id", "restricted"]

  # Package fields a new version replaces; missing ones are reset.
  @package_fields %{
    "description" => nil,
    "options_schema" => %{},
    "data_schema" => %{},
    "meta" => nil,
    "icon" => nil,
    "small_icon" => nil,
    "aspect_ratio" => nil,
    "webhook_url" => nil,
    "update_interval_seconds" => 60,
    "fonts" => [],
    "assets" => %{},
    "translations" => %{}
  }

  @doc """
  Installs an uploaded package in `network_id`. Options: `:uploaded_by` (user ID),
  `:store` (`fn key, body, content_type -> {:ok, url} | {:error, reason} end`,
  default `Castmill.PublicStorage.put/3`) and `:delete` (`fn key -> :ok | {:error, reason} end`,
  default `Castmill.PublicStorage.delete/1`).

  Returns `{:ok, %{widget: widget, created: boolean, version: integer, warnings: [String.t()]}}`
  or `{:error, reason}`, where reason is a message, a changeset, `:slug_taken`,
  `:invalid_slug`, `:managed_widget`, `{:unknown_fetcher, name}` or
  `{:incompatible, items}` (the saved items the new version would break).
  """
  def install(network_id, %Plug.Upload{} = upload, opts \\ []) do
    with {:ok, content} <- read_package(upload),
         {:ok, widget_data, assets} <- PackageProcessor.process_upload(upload) do
      try do
        do_install(network_id, widget_data, assets, package_attrs(upload, content), opts)
      after
        PackageProcessor.cleanup_assets(assets)
      end
    end
  end

  defp read_package(%Plug.Upload{path: path}) do
    case File.read(path) do
      {:ok, content} when byte_size(content) <= @max_package_size -> {:ok, content}
      {:ok, _content} -> {:error, "Package too large (max: 10.0 MB)"}
      {:error, _reason} -> {:error, "Failed to read uploaded file"}
    end
  end

  defp package_attrs(upload, content) do
    %{
      filename: Path.basename(upload.filename || "widget"),
      content_type: upload.content_type || "application/octet-stream",
      size: byte_size(content),
      sha256: :crypto.hash(:sha256, content) |> Base.encode16(case: :lower),
      content: content
    }
  end

  # Storing a slug's assets, committing its package and deleting its unused assets
  # hold the slug's lock: cleanup can't delete an asset (same content, same key)
  # that a concurrent upload stored and is about to commit.
  defp do_install(network_id, widget_data, assets, package, opts) do
    store = Keyword.get(opts, :store, &Castmill.PublicStorage.put/3)
    slug = widget_data["slug"] || slugify(widget_data["name"])
    integration = integration(widget_data)

    with :ok <- valid_slug(slug),
         :ok <- Integrations.validate_integration_meta(integration) do
      widget_data = Map.put(widget_data, "integration", integration)

      Repo.transaction(fn ->
        lock_slug(slug)

        with {:ok, existing} <- replaceable(network_id, slug),
             {:ok, urls, keys} <- store_assets(slug, assets, store) do
          package = Map.put(package, :asset_keys, keys)

          case install_widget(network_id, existing, widget_data, slug, urls, package, opts) do
            {:ok, result, pruned_keys} -> {result, pruned_keys}
            {:error, reason} -> Repo.rollback({reason, keys})
          end
        else
          {:error, reason, keys} -> Repo.rollback({reason, keys})
          {:error, reason} -> Repo.rollback({reason, []})
        end
      end)
      |> case do
        {:ok, {result, pruned_keys}} ->
          release_assets(slug, pruned_keys, opts)
          {:ok, result}

        {:error, {reason, keys}} ->
          release_assets(slug, keys, opts)
          {:error, reason}
      end
    end
  end

  # The integration the widget will have: the package's `integration`, or the one
  # in its `meta`.
  defp integration(widget_data) do
    case widget_data do
      %{"integration" => integration} -> integration
      %{"meta" => %{"integration" => integration}} -> integration
      _ -> nil
    end
  end

  # Runs in the install transaction, which holds the widget's row lock: playlist
  # items and config edits (which hold a share lock on it) can't save options
  # against the old version while the new one is checked and saved.
  defp install_widget(network_id, existing, widget_data, slug, urls, package, opts) do
    created? = is_nil(existing)

    with {:ok, attrs} <- widget_attrs(widget_data, slug, urls),
         {:ok, changeset} <- changeset(existing, attrs, network_id),
         :ok <- compatible(existing, changeset),
         :ok <- keeps_integrations(existing, changeset),
         {:ok, widget} <- Repo.insert_or_update(changeset),
         {:ok, _} <-
           if(created?,
             do: NetworkAccess.set_access(network_id, widget.id, "hidden"),
             else: {:ok, nil}
           ),
         {:ok, _} <- Integrations.sync_integration_from_meta(widget),
         {:ok, version, pruned_keys} <- record_package(widget, package, opts[:uploaded_by]) do
      {:ok, %{widget: widget, created: created?, version: version, warnings: warnings(widget)},
       pruned_keys}
    end
  end

  defp valid_slug(slug) do
    if AssetStorage.valid_slug?(slug), do: :ok, else: {:error, :invalid_slug}
  end

  # Locks the widget with the slug, if any, and returns its current version.
  defp replaceable(network_id, slug) do
    case Repo.one(from(w in Widget, where: w.slug == ^slug, lock: "FOR UPDATE")) do
      nil ->
        {:ok, nil}

      %Widget{network_id: ^network_id} = widget ->
        if managed?(widget), do: {:error, :managed_widget}, else: {:ok, widget}

      _widget ->
        {:error, :slug_taken}
    end
  end

  # A transaction lock on the slug, for every node.
  defp lock_slug(slug) do
    Repo.query!("SELECT pg_advisory_xact_lock(hashtext($1))", ["widget-package:#{slug}"])
  end

  @doc "Whether the platform manages the widget (e.g. installs it at deploy)."
  def managed?(%Widget{meta: %{"managed_by" => by}}) when is_binary(by) and by != "", do: true
  def managed?(_widget), do: false

  # Same content, same key: unchanged assets are stored once.
  defp store_assets(slug, %{files: files}, store) when map_size(files) > 0 do
    Enum.reduce_while(files, {:ok, %{}, []}, fn {path, info}, {:ok, urls, keys} ->
      body = File.read!(info.path)
      hash = :crypto.hash(:sha256, body) |> Base.encode16(case: :lower) |> binary_part(0, 16)
      key = "widget-assets/#{slug}/#{hash}/#{String.replace_prefix(path, "assets/", "")}"

      case store.(key, body, info.type) do
        {:ok, url} ->
          {:cont, {:ok, Map.put(urls, path, url), [key | keys]}}

        {:error, reason} ->
          {:halt, {:error, "Failed to store asset #{path}: #{inspect(reason)}", keys}}
      end
    end)
  end

  defp store_assets(_slug, _assets, _store), do: {:ok, %{}, []}

  # Deletes stored assets of `slug` that no kept package version uses (versions with
  # the same content share them). A failed delete only leaves a file behind, so it
  # is logged.
  defp release_assets(_slug, [], _opts), do: :ok

  defp release_assets(slug, keys, opts) do
    delete = Keyword.get(opts, :delete, &Castmill.PublicStorage.delete/1)
    keys = Enum.uniq(keys)

    Repo.transaction(fn ->
      lock_slug(slug)

      used =
        from(p in WidgetPackage,
          where: fragment("? && ?", p.asset_keys, type(^keys, {:array, :string})),
          select: p.asset_keys
        )
        |> Repo.all()
        |> List.flatten()
        |> MapSet.new()

      for key <- keys, not MapSet.member?(used, key) do
        with {:error, reason} <- delete.(key) do
          Logger.warning("[Widgets.Packages] Could not delete asset #{key}: #{inspect(reason)}")
        end
      end
    end)

    :ok
  end

  defp widget_attrs(widget_data, slug, urls) do
    integration = widget_data["integration"]
    meta = Map.drop(widget_data["meta"] || %{}, ["managed_by", "integration"])
    meta = if is_map(integration), do: Map.put(meta, "integration", integration), else: meta

    data =
      widget_data
      |> Map.drop(["integration" | @scope_fields])
      |> Map.put("slug", slug)
      |> Map.put("meta", if(meta == %{}, do: nil, else: meta))

    with {:ok, data} <- PackageProcessor.resolve_asset_references(data, &Map.get(urls, &1)),
         {:ok, fonts} <- fonts(data, urls) do
      data =
        data
        |> put_asset_url("icon", urls)
        |> put_asset_url("small_icon", urls)
        |> then(&if(fonts == [], do: &1, else: Map.put(&1, "fonts", fonts)))

      {:ok, Map.merge(@package_fields, data)}
    end
  end

  # An icon given as a path in the package (e.g. "assets/icons/icon.svg").
  defp put_asset_url(data, field, urls) do
    case Map.fetch(urls, data[field] || "") do
      {:ok, url} -> Map.put(data, field, url)
      :error -> data
    end
  end

  defp fonts(data, urls) do
    data
    |> AssetStorage.font_entries(&Map.get(urls, &1))
    |> Enum.reduce_while({:ok, []}, fn
      %{"url" => nil, "path" => path}, _acc -> {:halt, {:error, "Unknown font asset #{path}"}}
      font, {:ok, fonts} -> {:cont, {:ok, [Map.delete(font, "path") | fonts]}}
    end)
    |> case do
      {:ok, fonts} -> {:ok, Enum.reverse(fonts)}
      error -> error
    end
  end

  defp changeset(nil, attrs, network_id) do
    %Widget{}
    |> Widget.changeset(attrs)
    |> Widget.scope_changeset(%{is_system: false, network_id: network_id})
    |> valid_changeset()
  end

  defp changeset(%Widget{} = widget, attrs, _network_id) do
    widget |> Widget.changeset(attrs) |> valid_changeset()
  end

  defp valid_changeset(%Ecto.Changeset{valid?: true} = changeset), do: {:ok, changeset}
  defp valid_changeset(changeset), do: {:error, changeset}

  defp compatible(nil, _changeset), do: :ok

  defp compatible(%Widget{} = widget, changeset) do
    updated = Ecto.Changeset.apply_changes(changeset)

    case incompatible_items(widget.id, updated) do
      [] -> :ok
      items -> {:error, {:incompatible, items}}
    end
  end

  # A new version can't rename or remove the integration the widget has: its
  # organizations' credentials, cached data and polling belong to it.
  defp keeps_integrations(nil, _changeset), do: :ok

  defp keeps_integrations(%Widget{id: widget_id}, changeset) do
    name =
      case get_in(Ecto.Changeset.get_field(changeset, :meta) || %{}, ["integration"]) do
        %{} = integration -> Map.get(integration, "name") || "default"
        _ -> nil
      end

    existing =
      Repo.all(from(i in WidgetIntegration, where: i.widget_id == ^widget_id, select: i.name))

    case existing -- [name] do
      [] ->
        :ok

      names ->
        {:error,
         "This version can't rename or remove the widget's integration " <>
           Enum.map_join(names, ", ", &~s("#{&1}"))}
    end
  end

  @doc """
  The saved playlist items of `widget_id` that would be invalid with `widget`'s
  options and data schemas and editable texts.
  """
  def incompatible_items(widget_id, %Widget{} = widget) do
    reserved? = TextOverrides.reserved?(widget)

    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: p in assoc(pi, :playlist),
      where: wc.widget_id == ^widget_id,
      order_by: [asc: p.name, asc: pi.id],
      select: %{
        options: wc.options,
        data: wc.data,
        playlist_id: p.id,
        playlist_name: p.name,
        organization_id: p.organization_id
      }
    )
    |> Repo.all()
    |> Enum.flat_map(fn item ->
      options = item.options || %{}

      error =
        with {:ok, _} <- Schema.validate_data(widget.options_schema || %{}, options),
             {:ok, _} <- validate_saved_data(widget.data_schema || %{}, item.data),
             :ok <-
               if(reserved?, do: TextOverrides.validate(options["overrides"], widget), else: :ok) do
          nil
        else
          {:error, message} -> to_string(message)
        end

      if error,
        do: [item |> Map.drop([:options, :data]) |> Map.put(:error, error)],
        else: []
    end)
  end

  # Like WidgetConfig.changeset/2, which doesn't validate absent data.
  defp validate_saved_data(_schema, nil), do: {:ok, nil}
  defp validate_saved_data(schema, data), do: Schema.validate_data(schema, data)

  # Returns the asset keys of the versions it no longer keeps.
  defp record_package(widget, package, uploaded_by) do
    version =
      (Repo.one(
         from(p in WidgetPackage, where: p.widget_id == ^widget.id, select: max(p.version))
       ) ||
         0) + 1

    %WidgetPackage{widget_id: widget.id, version: version, uploaded_by_id: uploaded_by}
    |> Ecto.Changeset.change(package)
    |> Repo.insert()
    |> case do
      {:ok, _package} ->
        {_count, pruned} =
          Repo.delete_all(
            from(p in WidgetPackage,
              where: p.widget_id == ^widget.id and p.version <= ^(version - @kept_versions),
              select: p.asset_keys
            )
          )

        {:ok, version, List.flatten(pruned)}

      error ->
        error
    end
  end

  defp warnings(widget) do
    {_errors, warnings} = Widgets.TemplateBindings.check(widget.template)
    Enum.map(warnings, &Widgets.TemplateBindings.describe/1)
  end

  @doc "The kept versions of a widget's package, newest first, without their content."
  def list_versions(widget_id) do
    from(p in WidgetPackage,
      where: p.widget_id == ^widget_id,
      order_by: [desc: p.version],
      select: %{
        version: p.version,
        filename: p.filename,
        size: p.size,
        sha256: p.sha256,
        uploaded_by_id: p.uploaded_by_id,
        inserted_at: p.inserted_at
      }
    )
    |> Repo.all()
  end

  @doc "The latest package version of each of `widget_ids`: `%{widget_id => %{version, inserted_at}}`."
  def latest_versions([]), do: %{}

  def latest_versions(widget_ids) do
    latest =
      from(p in WidgetPackage,
        where: p.widget_id in ^widget_ids,
        group_by: p.widget_id,
        select: %{widget_id: p.widget_id, version: max(p.version)}
      )

    from(p in WidgetPackage,
      join: l in subquery(latest),
      on: l.widget_id == p.widget_id and l.version == p.version,
      select: {p.widget_id, %{version: p.version, inserted_at: p.inserted_at}}
    )
    |> Repo.all()
    |> Map.new()
  end

  @doc "A kept package version, with its content, or nil."
  def get_version(widget_id, version) do
    Repo.get_by(WidgetPackage, widget_id: widget_id, version: version)
  end

  @doc """
  Deletes an uploaded network widget of `network_id` that no playlist uses, and the
  assets of its packages. Returns `{:ok, widget}`, `{:error, :not_found}`,
  `{:error, :managed_widget}` or `{:error, {:in_use, organization_ids}}`. Takes the
  `:delete` option of `install/3`.
  """
  def delete_network_widget(network_id, widget_id, opts \\ []) do
    case get_widget(widget_id) do
      %Widget{network_id: ^network_id, slug: slug} = widget ->
        # The widget's row lock, held until it is deleted, makes playlist insertions
        # (which hold a share lock on it) wait, so the usage check stays true.
        Repo.transaction(fn ->
          lock_slug(slug)

          with %Widget{network_id: ^network_id} = widget <- lock_widget(widget.id),
               false <- managed?(widget),
               [] <- using_organizations(widget.id) do
            keys =
              Repo.all(
                from(p in WidgetPackage, where: p.widget_id == ^widget.id, select: p.asset_keys)
              )

            case Widgets.delete_widget_with_cascade(widget) do
              {:ok, deleted} -> {deleted, List.flatten(keys)}
              {:error, reason} -> Repo.rollback(reason)
            end
          else
            true -> Repo.rollback(:managed_widget)
            [_ | _] = organization_ids -> Repo.rollback({:in_use, organization_ids})
            _ -> Repo.rollback(:not_found)
          end
        end)
        |> case do
          {:ok, {deleted, keys}} ->
            release_assets(slug, keys, opts)
            {:ok, deleted}

          error ->
            error
        end

      _ ->
        {:error, :not_found}
    end
  end

  defp lock_widget(widget_id) do
    Repo.one(from(w in Widget, where: w.id == ^widget_id, lock: "FOR UPDATE"))
  end

  @doc "The IDs of the playlists with items of `widget_id`."
  def using_playlists(widget_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      where: wc.widget_id == ^widget_id,
      distinct: true,
      select: pi.playlist_id
    )
    |> Repo.all()
  end

  defp get_widget(widget_id) do
    case Integer.parse(to_string(widget_id)) do
      {id, ""} -> Repo.get(Widget, id)
      _ -> nil
    end
  end

  defp using_organizations(widget_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: p in assoc(pi, :playlist),
      where: wc.widget_id == ^widget_id,
      distinct: true,
      select: p.organization_id
    )
    |> Repo.all()
  end

  defp slugify(name) when is_binary(name) do
    name
    |> String.downcase()
    |> String.replace(~r/[^a-z0-9\s-]/, "")
    |> String.replace(~r/\s+/, "-")
    |> String.trim("-")
  end

  defp slugify(_name), do: ""
end
