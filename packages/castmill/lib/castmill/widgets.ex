defmodule Castmill.Widgets do
  @moduledoc """
  The Widgets context.
  """
  import Ecto.Query, warn: false
  require Logger

  alias Castmill.Repo
  alias Castmill.Protocol.Access
  alias Castmill.Widgets.AssetStorage
  alias Castmill.Widgets.Widget
  alias Castmill.Widgets.WidgetConfig
  alias Castmill.Widgets.WidgetOrganization
  alias Castmill.QueryHelpers

  defimpl Access, for: Widget do
    def canAccess(_team, user, _action) do
      if is_nil(user) do
        {:error, "No user provided"}
      else
        # network_admin = Repo.get_by(Castmill.Networks.NetworksAdmins, network_id: network.id, user_id: user.id)
        # if network_admin !== nil do
        #   {:ok, true}
        # else
        #   {:ok, false}
        # end
      end
    end
  end

  @doc """
  Returns all widgets (any scope) with optional pagination, search, and sorting.

  For internal and root-admin use. Organization-facing code must use
  `list_available_widgets/2`.

  ## Examples

      iex> list_widgets()
      [%Widget{}, ...]

      iex> list_widgets(%{page: 1, page_size: 10, search: "text"})
      [%Widget{}, ...]
  """
  def list_widgets(params \\ %{}), do: list_from(Widget.base_query(), params)

  @doc """
  Returns the count of widgets (any scope) matching the search criteria.
  """
  def count_widgets(params \\ %{}), do: count_from(Widget.base_query(), params)

  @doc """
  Lists the widgets available to an organization (see `available_query/1`).
  """
  def list_available_widgets(organization_id, params \\ %{}) do
    organization_id
    |> available_query()
    |> list_from(params)
    |> Enum.map(&put_access(&1, organization_id))
  end

  @doc """
  Counts the widgets available to an organization.
  """
  def count_available_widgets(organization_id, params \\ %{}),
    do: organization_id |> available_query() |> count_from(params)

  defp list_from(query, %{
         page: page,
         page_size: page_size,
         search: search,
         key: sort_key,
         direction: sort_direction
       }) do
    offset = (page_size && max((page - 1) * page_size, 0)) || 0

    sort_dir =
      case sort_direction do
        "ascending" -> :asc
        "descending" -> :desc
        _ -> :asc
      end

    sort_field =
      case sort_key do
        "name" -> :name
        "inserted_at" -> :inserted_at
        "updated_at" -> :updated_at
        _ -> :name
      end

    query
    |> QueryHelpers.where_name_like(search)
    |> order_by([w], [{^sort_dir, field(w, ^sort_field)}])
    |> limit(^page_size)
    |> offset(^offset)
    |> Repo.all()
    |> Enum.map(&sanitize_widget_assets/1)
  end

  defp list_from(query, _params) do
    query
    |> Repo.all()
    |> Enum.map(&sanitize_widget_assets/1)
  end

  defp count_from(query, %{search: search}) do
    query
    |> QueryHelpers.where_name_like(search)
    |> Repo.aggregate(:count, :id)
  end

  defp count_from(query, _params), do: Repo.aggregate(query, :count, :id)

  @doc """
  Gets a widget by its id.

  ## Examples

      iex> get_widget("1234")
      %Widget{}
  """
  def get_widget(id) do
    Widget
    |> Repo.get(id)
    |> sanitize_widget_assets()
  end

  @doc """
  Gets a widget by name.
  """
  def get_widget_by_name(name) do
    Widget
    |> Repo.get_by(name: name)
    |> sanitize_widget_assets()
  end

  def sanitize_widget_assets(%Widget{} = widget) do
    %{
      widget
      | icon: AssetStorage.sanitize_public_icon(widget.icon),
        small_icon: AssetStorage.sanitize_public_icon(widget.small_icon)
    }
  end

  def sanitize_widget_assets(widget), do: widget

  @doc """
  Instantiate a new widget.
  A widget instance is represented by a row in the widgets_config table.

  If the widget has an integration definition in its meta field, this function
  also ensures the integration record exists (creates it if needed).

  TODO:
  The data should be fetched from the widgets webhook endpoint, so a new widget instance will always have
  some valid data.

  We would possible like to encrypt this data before storing it in the database with a key that is unique
  for the organization that owns the widget instance.

  ## Examples

      iex> new_widget_config("w_id", "pii_id", %{ "foo" => "bar" })
      %WidgetConfig{}
  """
  def new_widget_config(widget_id, playlist_item_id, options, data \\ nil, opts \\ []) do
    # First ensure the integration exists if the widget has one defined
    widget = get_widget(widget_id)
    organization_id = Keyword.get(opts, :organization_id)

    Logger.debug("new_widget_config: widget_id=#{widget_id}, org_id=#{inspect(organization_id)}")

    integration =
      if widget do
        # Ensure integration exists for widgets with integration definitions
        case Castmill.Widgets.Integrations.ensure_integration_for_widget(widget) do
          {:ok, integration} ->
            Logger.debug(
              "new_widget_config: Found integration #{inspect(integration && integration.id)}"
            )

            integration

          other ->
            Logger.debug(
              "new_widget_config: ensure_integration_for_widget returned #{inspect(other)}"
            )

            nil
        end
      else
        Logger.debug("new_widget_config: Widget not found")
        nil
      end

    # Create the widget config
    result =
      %WidgetConfig{}
      |> WidgetConfig.changeset(%{
        widget_id: widget_id,
        playlist_item_id: playlist_item_id,
        options: options,
        data: data,
        version: 1,
        last_request_at: nil
      })
      |> Repo.insert()

    # Schedule polling for integrations that can be fetched without the
    # organization having to configure credentials (like RSS or Open-Meteo)
    with {:ok, _widget_config} <- result,
         %Castmill.Widgets.Integrations.WidgetIntegration{} = int <- integration,
         true <- is_credential_free_integration?(int),
         org_id when not is_nil(org_id) <- organization_id do
      Logger.info(
        "new_widget_config: Scheduling polling for credential-free integration #{int.id}"
      )

      schedule_auth_free_polling(org_id, widget_id, int, options)
    else
      other ->
        Logger.debug(
          "new_widget_config: Skipping schedule, with clause failed: #{inspect(other)}"
        )

        other
    end

    result
  end

  defp is_credential_free_integration?(
         %Castmill.Widgets.Integrations.WidgetIntegration{} = integration
       ) do
    # Integrations that can be fetched without credentials configured by the
    # organization. "optional" integrations are included: any configured key is
    # still resolved at fetch time by `Integrations.get_fetch_credentials/2`.
    auth_type =
      get_in(integration.pull_config, ["auth_type"]) ||
        get_in(integration.credential_schema, ["auth_type"])

    auth_type in ["none", "optional"]
  end

  defp schedule_auth_free_polling(organization_id, widget_id, integration, widget_options) do
    widget_options =
      Castmill.Widgets.Integrations.with_display_locale(organization_id, widget_options)

    # Build discriminator ID based on integration type
    discriminator_id = build_discriminator_id(integration, widget_options, organization_id)

    Logger.info(
      "Scheduling auth-free polling for widget #{widget_id}, org #{organization_id}, discriminator: #{discriminator_id}"
    )

    schedule_fn = fn ->
      try do
        result =
          Castmill.Workers.IntegrationPoller.schedule_poll(%{
            organization_id: organization_id,
            widget_id: widget_id,
            integration_id: integration.id,
            discriminator_id: discriminator_id,
            widget_options: widget_options
          })

        Logger.info("Schedule poll result: #{inspect(result)}")
      rescue
        e ->
          Logger.warning("Failed to schedule auth-free polling: #{inspect(e)}")
      catch
        :exit, reason ->
          Logger.warning("Failed to schedule auth-free polling (exit): #{inspect(reason)}")
      end
    end

    if Application.get_env(:castmill, :async_poll_scheduling, true) do
      # Spawn a separate process to schedule the poll, so that:
      # 1. It doesn't block the database transaction
      # 2. If BullMQ backend isn't available, it doesn't crash the transaction
      Task.start(schedule_fn)
    else
      schedule_fn.()
    end
  end

  defp build_discriminator_id(integration, widget_options, organization_id) do
    Castmill.Widgets.Integrations.build_discriminator_id(
      integration,
      widget_options,
      organization_id
    )
  end

  def get_widget_by_slug(slug) do
    Widget
    |> where([w], w.slug == ^slug)
    |> Repo.one()
  end

  # ===========================================================================
  # Scope & availability
  # ===========================================================================

  @doc """
  Query of the widgets available to an organization:

    * its own widgets,
    * system widgets and its network's widgets, unless they are restricted and not
      enabled for the organization.

  System and network widgets are also subject to the network's policy
  (`Castmill.Widgets.NetworkAccess`): hidden from the whole network, offered only to
  selected organizations, or to all organizations except some.

  Unassigned widgets (non-system, no owner) are available to no organization. Invalid
  or unknown organization ids yield an empty query.
  """
  def available_query(organization_id) do
    with {:ok, organization_id} <- Ecto.UUID.cast(organization_id) do
      available_to_organizations_query()
      |> where([organization: o], o.id == ^organization_id)
    else
      _ -> from(w in Widget, as: :widget, where: false)
    end
  end

  defp available_to_organizations_query do
    from(w in Widget,
      as: :widget,
      join: o in Castmill.Organizations.Organization,
      as: :organization,
      on: true,
      left_join: wo in WidgetOrganization,
      on: wo.widget_id == w.id and wo.organization_id == o.id,
      left_join: policy in Castmill.Widgets.NetworkWidgetPolicy,
      on: policy.widget_id == w.id and policy.network_id == o.network_id,
      left_join: listed in Castmill.Widgets.NetworkWidgetOrganization,
      on: listed.widget_id == w.id and listed.organization_id == o.id,
      where: not is_nil(o.network_id),
      where:
        w.organization_id == o.id or
          ((w.is_system == true or w.network_id == o.network_id) and
             (w.restricted == false or not is_nil(wo.widget_id)) and
             (is_nil(policy.mode) or policy.mode != "hidden") and
             (is_nil(policy.mode) or policy.mode != "selected" or not is_nil(listed.widget_id)) and
             (is_nil(policy.mode) or policy.mode != "except" or is_nil(listed.widget_id)))
    )
  end

  defp organization_network_id(organization_id) do
    from(o in Castmill.Organizations.Organization,
      where: o.id == ^organization_id,
      select: o.network_id
    )
    |> Repo.one()
  end

  @doc """
  Gets a widget by id if it is available to the organization, otherwise nil.
  """
  def get_available_widget(organization_id, widget_id) do
    with {:ok, id} <- cast_widget_id(widget_id),
         %Widget{} = widget <-
           organization_id |> available_query() |> where([w], w.id == ^id) |> Repo.one() do
      widget |> sanitize_widget_assets() |> put_access(organization_id)
    else
      _ -> nil
    end
  end

  @doc """
  Gets a widget by slug if it is available to the organization, otherwise nil.
  """
  def get_available_widget_by_slug(organization_id, slug) when is_binary(slug) do
    organization_id
    |> available_query()
    |> where([w], w.slug == ^slug)
    |> Repo.one()
    |> case do
      nil -> nil
      widget -> widget |> sanitize_widget_assets() |> put_access(organization_id)
    end
  end

  def get_available_widget_by_slug(_organization_id, _slug), do: nil

  @doc """
  Whether a widget is available to an organization.

  Pass `lock: true` inside a transaction to hold a share lock on the widget row, so a
  concurrent scope change cannot revoke it before dependent rows are written.
  """
  def available?(organization_id, widget_id, opts \\ []) do
    case cast_widget_id(widget_id) do
      {:ok, id} ->
        # Lock first, in its own statement: a scope change holds the row FOR UPDATE, and
        # the availability check below then runs with a fresh snapshot that includes it.
        if Keyword.get(opts, :lock) do
          from(w in Widget, where: w.id == ^id, lock: "FOR SHARE", select: w.id) |> Repo.one()
        end

        query =
          organization_id |> available_query() |> where([w], w.id == ^id) |> select([w], w.id)

        Repo.one(query) != nil

      :error ->
        false
    end
  end

  @doc """
  Gets a widget owned by the organization (organization scope), otherwise nil.
  """
  def get_organization_widget(organization_id, widget_id) do
    with {:ok, id} <- cast_widget_id(widget_id),
         {:ok, organization_id} <- Ecto.UUID.cast(organization_id),
         %Widget{} = widget <-
           Repo.one(
             from(w in Widget, where: w.id == ^id and w.organization_id == ^organization_id)
           ) do
      widget |> sanitize_widget_assets() |> put_access(organization_id)
    else
      _ -> nil
    end
  end

  @doc """
  Fills the virtual `scope` and `can_manage` fields for the requesting organization.
  """
  def put_access(%Widget{} = widget, organization_id) do
    %{widget | scope: scope(widget), can_manage: widget.organization_id == organization_id}
  end

  def put_access(widget, _organization_id), do: widget

  @doc """
  The widget's scope: "system", "network", "organization" or "unassigned".
  """
  def scope(%Widget{is_system: true}), do: "system"
  def scope(%Widget{network_id: network_id}) when not is_nil(network_id), do: "network"

  def scope(%Widget{organization_id: organization_id}) when not is_nil(organization_id),
    do: "organization"

  def scope(%Widget{}), do: "unassigned"

  defp cast_widget_id(id) when is_integer(id), do: {:ok, id}

  defp cast_widget_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {int, ""} -> {:ok, int}
      _ -> :error
    end
  end

  defp cast_widget_id(_), do: :error

  @doc """
  Creates a widget owned by an organization. Scope fields in `attrs` are ignored, so
  an uploaded package cannot declare itself a system or network widget.
  """
  def create_organization_widget(organization_id, attrs) do
    attrs =
      Map.drop(
        attrs,
        ["is_system", "network_id", "organization_id", "restricted"] ++
          [:is_system, :network_id, :organization_id, :restricted]
      )

    %Widget{}
    |> Widget.changeset(attrs)
    |> Widget.scope_changeset(%{
      is_system: false,
      network_id: nil,
      organization_id: organization_id,
      restricted: false
    })
    |> Repo.insert()
  end

  @doc """
  Updates the fields an organization may change on a widget it owns.
  """
  def update_organization_widget(%Widget{} = widget, attrs) do
    widget
    |> Widget.organization_update_changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Changes a widget's scope (trusted callers only: root admin, network admin tooling,
  SaaS addons). Accepts `is_system`, `network_id`, `organization_id` and `restricted`.

  Fails with `{:error, {:in_use, organization_ids}}` if organizations that use the
  widget in their playlists would lose access, so existing playlists never reference
  widgets their organization cannot use.
  """
  def set_widget_scope(%Widget{} = widget, attrs) do
    Repo.transaction(fn ->
      lock_widget!(widget.id)
      widget = Repo.get!(Widget, widget.id)

      with {:ok, updated} <- widget |> Widget.scope_changeset(attrs) |> Repo.update(),
           :ok <- ensure_users_keep_access(updated) do
        updated
      else
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Enables a restricted system or network widget for an organization. Network widgets
  can only be enabled for organizations of their network.
  """
  def enable_widget_for_organization(%Widget{} = widget, organization_id) do
    cond do
      not is_nil(widget.organization_id) ->
        {:error, :organization_widget}

      not widget.is_system and is_nil(widget.network_id) ->
        {:error, :unassigned_widget}

      not is_nil(widget.network_id) and
          organization_network_id(organization_id) != widget.network_id ->
        {:error, :organization_not_in_network}

      true ->
        %WidgetOrganization{}
        |> WidgetOrganization.changeset(%{widget_id: widget.id, organization_id: organization_id})
        |> Repo.insert(on_conflict: :nothing)
    end
  end

  @doc """
  Disables a widget for an organization. Fails with `{:error, {:in_use, ids}}` if the
  widget is restricted and the organization still uses it.
  """
  def disable_widget_for_organization(%Widget{} = widget, organization_id) do
    Repo.transaction(fn ->
      lock_widget!(widget.id)

      from(wo in WidgetOrganization,
        where: wo.widget_id == ^widget.id and wo.organization_id == ^organization_id
      )
      |> Repo.delete_all()

      case ensure_users_keep_access(Repo.get!(Widget, widget.id)) do
        :ok -> :ok
        {:error, reason} -> Repo.rollback(reason)
      end
    end)
  end

  @doc """
  Widgets relevant to a network's administration: system widgets, the network's own
  widgets and the widgets of its organizations.
  """
  def list_network_widgets(network_id) do
    organization_ids =
      from(o in Castmill.Organizations.Organization,
        where: o.network_id == ^network_id,
        select: o.id
      )

    from(w in Widget,
      where:
        w.is_system == true or w.network_id == ^network_id or
          w.organization_id in subquery(organization_ids),
      order_by: [asc: w.name]
    )
    |> Repo.all()
  end

  @doc """
  Organizations whose playlists use the widget.
  """
  def organizations_using_widget(widget_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: p in assoc(pi, :playlist),
      where: wc.widget_id == ^widget_id,
      distinct: true,
      select: p.organization_id
    )
    |> Repo.all()
  end

  @doc false
  # Fails with {:error, {:in_use, organization_ids}} when organizations whose playlists
  # use the widget can no longer use it. Call inside the transaction that changed access.
  def ensure_users_keep_access(%Widget{} = widget, opts \\ []) do
    network_id = Keyword.get(opts, :network_id)

    available_organizations =
      available_to_organizations_query()
      |> where([widget: w], w.id == ^widget.id)
      |> where_organization_network(network_id)
      |> select([organization: o], o.id)

    users =
      from(wc in WidgetConfig,
        join: pi in assoc(wc, :playlist_item),
        join: p in assoc(pi, :playlist),
        join: o in Castmill.Organizations.Organization,
        as: :organization,
        on: o.id == p.organization_id,
        where: wc.widget_id == ^widget.id and o.id not in subquery(available_organizations),
        distinct: true,
        select: o.id
      )

    case users |> where_organization_network(network_id) |> Repo.all() do
      [] -> :ok
      organization_ids -> {:error, {:in_use, organization_ids}}
    end
  end

  defp where_organization_network(query, nil), do: query

  defp where_organization_network(query, network_id),
    do: where(query, [organization: o], o.network_id == ^network_id)

  @doc false
  def lock_widget!(widget_id) do
    from(w in Widget, where: w.id == ^widget_id, lock: "FOR UPDATE", select: w.id)
    |> Repo.one!()
  end

  @doc """
  Gets the usage information for a widget, including all playlists where it is used.

  Returns a list of maps containing:
  - playlist_id: The ID of the playlist using this widget
  - playlist_name: The name of the playlist
  - playlist_item_id: The ID of the playlist item containing this widget
  - widget_config_id: The ID of the widget configuration

  ## Examples

      iex> get_widget_usage(123)
      [%{playlist_id: 1, playlist_name: "My Playlist", playlist_item_id: "uuid", widget_config_id: "uuid"}]

      iex> get_widget_usage(999)
      []
  """
  def get_widget_usage(widget_id, organization_id \\ nil) do
    query =
      from(wc in WidgetConfig,
        join: pi in assoc(wc, :playlist_item),
        join: p in assoc(pi, :playlist),
        where: wc.widget_id == ^widget_id,
        select: %{
          playlist_id: p.id,
          playlist_name: p.name,
          playlist_item_id: pi.id,
          widget_config_id: wc.id
        }
      )

    query =
      if organization_id,
        do: where(query, [_wc, _pi, p], p.organization_id == ^organization_id),
        else: query

    Repo.all(query)
  end

  @doc """
  Deletes a widget and all its associated widget_configs.

  This function first removes all widget_configs that reference the widget,
  then deletes the widget itself.

  ## Examples

      iex> delete_widget_with_cascade(widget)
      {:ok, %Widget{}}

      iex> delete_widget_with_cascade(widget_not_found)
      {:error, :widget_not_found}
  """
  def delete_widget_with_cascade(%Widget{} = widget) do
    Repo.transaction(fn ->
      lock_widget!(widget.id)

      # Remove the playlist items using the widget (their configs cascade), repairing
      # each playlist's linked list. Deleting only the configs would leave orphaned items.
      from(wc in WidgetConfig,
        join: pi in assoc(wc, :playlist_item),
        where: wc.widget_id == ^widget.id,
        select: {pi.playlist_id, pi.id}
      )
      |> Repo.all()
      |> Enum.each(fn {playlist_id, item_id} ->
        case Castmill.Resources.remove_item_from_playlist(playlist_id, item_id) do
          {:ok, _} -> :ok
          {:error, reason} -> Repo.rollback(reason)
        end
      end)

      # Then delete the widget itself
      case Repo.delete(widget) do
        {:ok, deleted_widget} -> deleted_widget
        {:error, changeset} -> Repo.rollback(changeset)
      end
    end)
  end

  def update_widget_config(playlist_id, playlist_item_id, options, data) do
    # First, check for circular references if this is a layout widget with playlist references
    with :ok <- validate_playlist_references(playlist_id, playlist_item_id, options) do
      case get_widget_config(playlist_id, playlist_item_id) do
        nil ->
          {:error, "No widget configuration found with the provided IDs"}

        %WidgetConfig{} = widget_config ->
          previous_options = widget_config.options || %{}

          case do_update_widget_config(widget_config, options, data, 3) do
            {:ok, _} = ok ->
              maybe_reschedule_polling(
                playlist_id,
                widget_config.widget_id,
                previous_options,
                options || previous_options
              )

              ok

            error ->
              error
          end
      end
    end
  end

  # When the saved options change the integration discriminator, the polling
  # scheduler for the previous discriminator becomes orphaned. Cancel it (unless
  # another widget config in the organization still uses it) and schedule the
  # discriminator that is actually saved.
  defp maybe_reschedule_polling(playlist_id, widget_id, previous_options, new_options) do
    alias Castmill.Widgets.Integrations

    with org_id when not is_nil(org_id) <- organization_id_for_playlist(playlist_id),
         %Widget{} = widget <- get_widget(widget_id),
         {:ok, %Castmill.Widgets.Integrations.WidgetIntegration{} = integration} <-
           Integrations.ensure_integration_for_widget(widget),
         true <- is_credential_free_integration?(integration) do
      previous_discriminator = discriminator_for_options(integration, org_id, previous_options)

      new_discriminator = discriminator_for_options(integration, org_id, new_options)

      if previous_discriminator != new_discriminator do
        unless discriminator_still_used?(
                 integration,
                 org_id,
                 widget_id,
                 previous_discriminator
               ) do
          cancel_polling(org_id, integration.id, previous_discriminator)
        end

        schedule_auth_free_polling(org_id, widget_id, integration, new_options)
      end

      :ok
    else
      _ -> :ok
    end
  end

  defp organization_id_for_playlist(playlist_id) do
    from(p in Castmill.Resources.Playlist,
      where: p.id == ^playlist_id,
      select: p.organization_id
    )
    |> Repo.one()
  end

  defp discriminator_for_options(integration, organization_id, options) do
    options = Castmill.Widgets.Integrations.with_display_locale(organization_id, options || %{})
    build_discriminator_id(integration, options, organization_id)
  end

  defp discriminator_still_used?(integration, organization_id, widget_id, discriminator_id) do
    from(wc in WidgetConfig,
      join: pi in Castmill.Resources.PlaylistItem,
      on: pi.id == wc.playlist_item_id,
      join: p in Castmill.Resources.Playlist,
      on: p.id == pi.playlist_id,
      where: p.organization_id == ^organization_id and wc.widget_id == ^widget_id,
      select: wc.options
    )
    |> Repo.all()
    |> Enum.any?(fn options ->
      discriminator_for_options(integration, organization_id, options) == discriminator_id
    end)
  end

  defp cancel_polling(organization_id, integration_id, discriminator_id) do
    cancel_fn = fn ->
      try do
        Castmill.Workers.IntegrationPoller.cancel_polling(
          organization_id,
          integration_id,
          discriminator_id
        )
      rescue
        e -> Logger.warning("Failed to cancel polling: #{inspect(e)}")
      catch
        :exit, reason -> Logger.warning("Failed to cancel polling (exit): #{inspect(reason)}")
      end
    end

    if Application.get_env(:castmill, :async_poll_scheduling, true) do
      Task.start(cancel_fn)
    else
      cancel_fn.()
    end

    :ok
  end

  # Updates the widget config through its changeset (so that the options and
  # data schemas are validated) while still guaranteeing that every successful
  # update advances the version. Optimistic locking makes the version bump
  # conflict-safe: concurrent writers raise `Ecto.StaleEntryError` and retry
  # against the freshly loaded record instead of silently writing the same
  # version twice.
  defp do_update_widget_config(%WidgetConfig{} = widget_config, options, data, attempts_left) do
    current_timestamp = DateTime.utc_now()

    # Fields that are not sent (nil) keep their current value, so that clients
    # can update the options or the data alone.
    attrs =
      %{last_request_at: current_timestamp}
      |> put_if_present(:options, options)
      |> put_if_present(:data, data)

    changeset =
      widget_config
      |> Ecto.Changeset.optimistic_lock(:version)
      |> WidgetConfig.changeset(attrs)

    try do
      # `force: true` guarantees the update (and therefore the optimistic lock
      # version bump) is issued even when the payload is identical to what is
      # already stored, e.g. two updates within the same second where the
      # truncated `last_request_at` does not change either.
      case Repo.update(changeset, force: true) do
        {:ok, _updated_widget_config} ->
          {:ok, "Widget configuration updated successfully"}

        {:error, _changeset} = error ->
          error
      end
    rescue
      Ecto.StaleEntryError ->
        if attempts_left > 1 do
          case Repo.get(WidgetConfig, widget_config.id) do
            nil ->
              {:error, "No widget configuration found with the provided IDs"}

            %WidgetConfig{} = reloaded ->
              do_update_widget_config(reloaded, options, data, attempts_left - 1)
          end
        else
          {:error, "Widget configuration was updated concurrently, please retry"}
        end
    end
  end

  defp put_if_present(attrs, _key, nil), do: attrs
  defp put_if_present(attrs, key, value), do: Map.put(attrs, key, value)

  @doc """
  Validates that playlist references in layout widgets don't create circular references.
  This is the public entry point for validation before a playlist item is created.

  Returns :ok if validation passes, or {:error, :circular_reference} if it would create a cycle.
  """
  def validate_playlist_references_for_widget(widget_id, playlist_id, options) do
    widget = get_widget(widget_id)

    if widget && is_layout_widget?(widget) do
      # Extract playlist IDs from options
      playlist_refs = extract_playlist_references(options)

      # Validate each playlist reference
      Enum.reduce_while(playlist_refs, :ok, fn ref_playlist_id, _acc ->
        case Castmill.Resources.validate_layout_playlist_reference(playlist_id, ref_playlist_id) do
          :ok -> {:cont, :ok}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    else
      :ok
    end
  end

  @doc """
  Validates that a widget's required integration credentials are configured for the organization.

  Widgets with integrations that have a non-empty credential_schema require credentials
  to be configured at the organization level before they can be added to a playlist.

  Returns :ok if validation passes, or {:error, :missing_integration_credentials} if
  credentials are required but not configured.

  ## Parameters
    - widget_id: The ID of the widget to validate
    - organization_id: The organization ID to check credentials for

  ## Examples

      iex> validate_integration_credentials_for_widget("spotify-now-playing", "org-123")
      :ok

      iex> validate_integration_credentials_for_widget("spotify-now-playing", "org-without-creds")
      {:error, :missing_integration_credentials}
  """
  def validate_integration_credentials_for_widget(widget_id, organization_id) do
    alias Castmill.Widgets.Integrations

    # Get all integrations for this widget
    integrations = Integrations.list_integrations(widget_id: widget_id)

    # Check each integration that requires credentials
    Enum.reduce_while(integrations, :ok, fn integration, _acc ->
      if integration_requires_credentials?(integration) do
        # Check if credentials exist for this organization
        case Integrations.get_credentials_by_scope(integration.id,
               organization_id: organization_id
             ) do
          nil -> {:halt, {:error, :missing_integration_credentials}}
          _credential -> {:cont, :ok}
        end
      else
        {:cont, :ok}
      end
    end)
  end

  # Checks if an integration requires credentials based on its credential_schema
  defp integration_requires_credentials?(integration) do
    credential_schema = integration.credential_schema

    cond do
      # No credential schema at all
      is_nil(credential_schema) ->
        false

      # Empty map
      credential_schema == %{} ->
        false

      # "optional" or "none" auth_type means credentials are not required upfront
      # (e.g., RSS feeds that work without auth)
      Map.get(credential_schema, "auth_type") in ["optional", "none"] ->
        false

      # Has required auth_type (e.g., "oauth2", "api_key", "basic")
      Map.has_key?(credential_schema, "auth_type") ->
        true

      # Has fields with at least one required field
      Map.has_key?(credential_schema, "fields") &&
          has_required_fields?(credential_schema["fields"]) ->
        true

      # Otherwise, doesn't require credentials
      true ->
        false
    end
  end

  # Checks if any field in the credential schema is required
  defp has_required_fields?(nil), do: false
  defp has_required_fields?(fields) when fields == %{}, do: false

  defp has_required_fields?(fields) when is_map(fields) do
    Enum.any?(fields, fn {_key, field_def} ->
      is_map(field_def) && Map.get(field_def, "required", false) == true
    end)
  end

  # Validates that playlist references in layout widgets don't create circular references
  # This version is used for updating existing widget configs
  defp validate_playlist_references(playlist_id, playlist_item_id, options) do
    # Get the widget config to check if it's a layout widget
    widget_config = get_widget_config_with_widget(playlist_id, playlist_item_id)

    if widget_config && is_layout_widget?(widget_config.widget) do
      # Extract playlist IDs from options
      playlist_refs = extract_playlist_references(options)

      # Validate each playlist reference
      Enum.reduce_while(playlist_refs, :ok, fn ref_playlist_id, _acc ->
        case Castmill.Resources.validate_layout_playlist_reference(playlist_id, ref_playlist_id) do
          :ok -> {:cont, :ok}
          {:error, reason} -> {:halt, {:error, reason}}
        end
      end)
    else
      :ok
    end
  end

  defp get_widget_config_with_widget(playlist_id, playlist_item_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: w in assoc(wc, :widget),
      where: pi.playlist_id == ^playlist_id and pi.id == ^playlist_item_id,
      preload: [widget: w]
    )
    |> Repo.one()
  end

  defp is_layout_widget?(widget) do
    widget && widget.slug in ["layout-widget"]
  end

  defp extract_playlist_references(options) when is_map(options) do
    # New Layout Widget stores playlist references in layoutRef.zonePlaylistMap
    # Format: %{"layoutRef" => %{"zonePlaylistMap" => %{"zone-id" => %{"playlistId" => 123}, ...}}}
    case get_in(options, ["layoutRef", "zonePlaylistMap"]) do
      zone_map when is_map(zone_map) ->
        zone_map
        |> Map.values()
        |> Enum.map(fn
          # Handle the correct format: %{"playlistId" => id}
          %{"playlistId" => id} when is_integer(id) ->
            id

          %{"playlistId" => id} when is_binary(id) ->
            case Integer.parse(id) do
              {int_id, ""} -> int_id
              _ -> nil
            end

          # Handle direct integer (legacy/simplified format)
          id when is_integer(id) ->
            id

          id when is_binary(id) ->
            case Integer.parse(id) do
              {int_id, ""} -> int_id
              _ -> nil
            end

          _ ->
            nil
        end)
        |> Enum.filter(&(&1 != nil))

      _ ->
        []
    end
  end

  defp extract_playlist_references(_), do: []

  @doc """
  Gets a widget config by its ID.
  """
  def get_widget_config_by_id(widget_config_id) do
    Repo.get(WidgetConfig, widget_config_id)
  end

  def get_widget_config(playlist_id, playlist_item_id) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      where: pi.playlist_id == ^playlist_id and pi.id == ^playlist_item_id,
      select: wc
    )
    |> Repo.one()
  end

  @doc """
  Creates a widget.

  ## Examples

      iex> create_widget(%{field: value})
      {:ok, %Widget{}}

      iex> create_widget(%{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def create_widget(attrs \\ %{}) do
    %Widget{}
    |> Widget.changeset(attrs)
    |> Repo.insert()
  end

  @doc """
  Updates a widget.

  ## Examples

      iex> update_widget(widget, %{field: new_value})
      {:ok, %Widget{}}

      iex> update_widget(widget, %{field: bad_value})
      {:error, %Ecto.Changeset{}}

  """
  def update_widget(%Widget{} = widget, attrs) do
    widget
    |> Widget.changeset(attrs)
    |> Repo.update()
  end

  @doc """
  Deletes a widget.

  ## Examples

      iex> delete_widget(widget)
      {:ok, %Widget{}}

      iex> delete_widget(widget)
      {:error, %Ecto.Changeset{}}

  """
  def delete_widget(%Widget{} = widget) do
    Repo.delete(widget)
  end

  @doc """
  Returns an `%Ecto.Changeset{}` for tracking widget changes.

  ## Examples

      iex> change_widget(widget)
      %Ecto.Changeset{data: %Widget{}}

  """
  def change_widget(%Widget{} = widget, attrs \\ %{}) do
    Widget.changeset(widget, attrs)
  end

  @doc """
  Gets the organization ID for a widget config.

  Traces through: WidgetConfig -> PlaylistItem -> Playlist -> Organization

  Returns `nil` if the widget config doesn't exist or isn't linked to a playlist.

  ## Examples

      iex> get_organization_id_for_widget_config("config-uuid")
      "org-uuid"

      iex> get_organization_id_for_widget_config("nonexistent")
      nil
  """
  def get_organization_id_for_widget_config(widget_config_id) do
    # Validate that widget_config_id is a valid UUID before querying
    # Some older widget configs have integer IDs which won't work with integrations
    case Ecto.UUID.cast(widget_config_id) do
      {:ok, _uuid} ->
        query =
          from wc in WidgetConfig,
            join: pi in assoc(wc, :playlist_item),
            join: p in assoc(pi, :playlist),
            where: wc.id == ^widget_config_id,
            select: p.organization_id

        Repo.one(query)

      :error ->
        # Not a valid UUID (e.g., integer ID from older widget configs)
        nil
    end
  end

  @doc """
  Gets the widget ID for a given widget config.

  Returns `nil` if the widget config doesn't exist.

  ## Examples

      iex> get_widget_id_for_config("config-uuid")
      7

      iex> get_widget_id_for_config("nonexistent")
      nil
  """
  def get_widget_id_for_config(widget_config_id) do
    case Ecto.UUID.cast(widget_config_id) do
      {:ok, _uuid} ->
        query =
          from wc in WidgetConfig,
            where: wc.id == ^widget_config_id,
            select: wc.widget_id

        Repo.one(query)

      :error ->
        nil
    end
  end
end
