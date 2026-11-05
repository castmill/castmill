defmodule Castmill.Widgets.NetworkAccess do
  @moduledoc """
  Network curation of the widget catalog.

  Network admins decide which system widgets and network-owned widgets the
  organizations of their network can use. Each curated widget has one access mode:

    * `"all"` – every eligible organization, including organizations created later,
    * `"except"` – every eligible organization except the listed ones (organizations
      created later are included),
    * `"selected"` – only the listed organizations,
    * `"hidden"` – no organization of the network.

  The mode is stored per network in `network_widget_policies`, with the listed
  organizations in `network_widget_organizations`, so a network never affects other
  networks. `Castmill.Widgets.available_query/1` applies it on top of the widget's
  platform scope.

  Network widgets restricted through `widgets_organizations` (for example by the scope
  backfill) are presented as `"selected"`/`"hidden"` and move to a network policy on
  their first change.

  Core widgets that the dashboard relies on (images, videos and layouts) are always
  available. Changes that would leave organizations with playlist items using a widget
  they can no longer use are refused with `{:error, {:in_use, organization_ids}}`.
  """
  import Ecto.Query, warn: false

  alias Castmill.Organizations.Organization
  alias Castmill.Repo
  alias Castmill.Widgets

  alias Castmill.Widgets.{
    NetworkWidgetOrganization,
    NetworkWidgetPolicy,
    Widget,
    WidgetConfig,
    WidgetOrganization
  }

  @core_slugs ~w(image video layout-widget)
  @access_modes ~w(all except selected hidden)
  @default_page_size 50
  @max_page_size 100

  @doc "Slugs of the widgets that are always available."
  def core_slugs, do: @core_slugs

  @doc "Whether the widget is a core widget that cannot be restricted."
  def core?(%Widget{slug: slug}), do: slug in @core_slugs

  # ===========================================================================
  # Reading
  # ===========================================================================

  @doc """
  Lists the widgets a network admin curates, with their access summary.

  Options (all optional): `:page`, `:page_size`, `:search`, `:kind` (`"system"` or
  `"network"`) and `:access` (one of the access modes).

  Returns `%{entries, total, page, page_size, summary, organizations_count}`, where
  `summary` counts the widgets of each access mode for the current search and kind.
  """
  def list_widgets(network_id, params \\ %{}) do
    {page, page_size} = pagination(params)

    base =
      network_id
      |> managed_query()
      |> where_search(params[:search])
      |> where_kind(params[:kind])

    filtered = where_access(base, network_id, params[:access])

    widgets =
      filtered
      |> order_by([widget: w], asc: fragment("lower(?)", w.name), asc: w.id)
      |> limit(^page_size)
      |> offset(^((page - 1) * page_size))
      |> Repo.all()
      |> Enum.map(&Widgets.sanitize_widget_assets/1)

    summary =
      Map.new(@access_modes, fn mode ->
        {mode, base |> where_access(network_id, mode) |> Repo.aggregate(:count, :id)}
      end)

    %{
      entries: describe(network_id, widgets),
      total: Repo.aggregate(filtered, :count, :id),
      page: page,
      page_size: page_size,
      summary: Map.put(summary, "total", Enum.sum(Map.values(summary))),
      organizations_count: organizations_count(network_id)
    }
  end

  @doc """
  Gets a widget the network admin curates with its access summary, or nil.
  """
  def get_widget(network_id, widget_id) do
    case get_managed_widget(network_id, widget_id) do
      nil -> nil
      widget -> network_id |> describe([Widgets.sanitize_widget_assets(widget)]) |> hd()
    end
  end

  @doc """
  Lists the organizations eligible to use a curated widget, with whether each one can
  use it (`enabled`) and whether its playlists use it (`in_use`).

  Options (all optional): `:page`, `:page_size`, `:search` and `:status`
  (`"enabled"` or `"disabled"`). Returns `{:ok, page}` or `{:error, :not_found}`.
  """
  def list_organizations(network_id, widget_id, params \\ %{}) do
    case get_managed_widget(network_id, widget_id) do
      nil ->
        {:error, :not_found}

      widget ->
        {page, page_size} = pagination(params)
        enabled_ids = enabled_ids_query(network_id, widget, state(network_id, widget))

        base =
          network_id
          |> eligible_organizations_query(widget)
          |> where_search(params[:search])

        filtered =
          case params[:status] do
            "enabled" -> where(base, [organization: o], o.id in subquery(enabled_ids))
            "disabled" -> where(base, [organization: o], o.id not in subquery(enabled_ids))
            _ -> base
          end

        organizations =
          filtered
          |> order_by([organization: o], asc: fragment("lower(?)", o.name), asc: o.id)
          |> limit(^page_size)
          |> offset(^((page - 1) * page_size))
          |> select([organization: o], %{id: o.id, name: o.name})
          |> Repo.all()

        page_ids = Enum.map(organizations, & &1.id)

        enabled =
          from(o in Organization,
            where: o.id in ^page_ids and o.id in subquery(enabled_ids),
            select: o.id
          )
          |> Repo.all()
          |> MapSet.new()

        in_use = network_id |> organizations_using(widget.id, page_ids) |> MapSet.new()

        {:ok,
         %{
           entries:
             Enum.map(organizations, fn organization ->
               Map.merge(organization, %{
                 enabled: MapSet.member?(enabled, organization.id),
                 in_use: MapSet.member?(in_use, organization.id)
               })
             end),
           total: Repo.aggregate(filtered, :count, :id),
           page: page,
           page_size: page_size,
           counts: %{
             "total" => Repo.aggregate(base, :count, :id),
             "enabled" =>
               base
               |> where([organization: o], o.id in subquery(enabled_ids))
               |> Repo.aggregate(:count, :id)
           }
         }}
    end
  end

  @doc "Names of the given organizations, sorted by name."
  def organization_names(organization_ids) do
    from(o in Organization,
      where: o.id in ^organization_ids,
      order_by: [asc: o.name],
      select: %{id: o.id, name: o.name}
    )
    |> Repo.all()
  end

  # ===========================================================================
  # Writing
  # ===========================================================================

  @doc """
  Sets the access mode of a curated widget.

  Switching between `"all"`, `"except"` and `"selected"` keeps the organizations that
  can use the widget unchanged: `"all"` to `"except"` starts without exclusions, and
  `"selected"` starts with the organizations that can currently use it.
  """
  def set_access(network_id, widget_id, mode) when mode in @access_modes do
    transaction(network_id, widget_id, fn widget ->
      state = state(network_id, widget)

      cond do
        mode != "all" and core?(widget) ->
          {:error, :core_widget}

        mode == state.mode ->
          :ok

        mode in ["all", "hidden"] ->
          write_policy(network_id, widget, mode, [])

        mode == "selected" ->
          write_policy(network_id, widget, mode, enabled_ids(network_id, widget, state))

        mode == "except" ->
          excluded =
            eligible_ids(network_id, widget) -- enabled_ids(network_id, widget, state)

          write_policy(network_id, widget, mode, excluded)
      end
    end)
  end

  def set_access(_network_id, _widget_id, _mode), do: {:error, :invalid_access}

  @doc """
  Enables and disables organizations for a curated widget.

  `changes` is either `%{enable: ids, disable: ids}`, or a bulk change of every
  eligible organization matching a search: `%{search: text, enabled: boolean}`.

  Disabling organizations of a widget available to all excludes them (`"except"`), so
  organizations created later still get the widget. Enabling organizations of a hidden
  widget selects them (`"selected"`).
  """
  def update_organizations(network_id, widget_id, changes) do
    transaction(network_id, widget_id, fn widget ->
      with {:ok, enable, disable} <- resolve_changes(network_id, widget, changes),
           :ok <- validate_organizations(network_id, widget, enable ++ disable) do
        state = state(network_id, widget)
        listed = listed_ids(network_id, widget, state)

        cond do
          disable != [] and core?(widget) ->
            {:error, :core_widget}

          state.mode == "all" ->
            if disable == [], do: :ok, else: write_policy(network_id, widget, "except", disable)

          state.mode == "except" ->
            write_policy(network_id, widget, "except", Enum.uniq((listed -- enable) ++ disable))

          state.mode == "selected" ->
            write_policy(network_id, widget, "selected", Enum.uniq(listed ++ enable) -- disable)

          enable == [] ->
            :ok

          true ->
            write_policy(network_id, widget, "selected", enable)
        end
      end
    end)
  end

  defp transaction(network_id, widget_id, change) do
    Repo.transaction(fn ->
      with {:ok, id} <- cast_widget_id(widget_id),
           _ <- lock(id),
           %Widget{} = widget <- get_managed_widget(network_id, id),
           :ok <- change.(widget),
           :ok <-
             Widgets.ensure_users_keep_access(Repo.get!(Widget, id), network_id: network_id) do
        get_widget(network_id, id)
      else
        {:error, reason} -> Repo.rollback(reason)
        _ -> Repo.rollback(:not_found)
      end
    end)
  end

  defp lock(id) do
    from(w in Widget, where: w.id == ^id, lock: "FOR UPDATE", select: w.id) |> Repo.one()
  end

  defp resolve_changes(network_id, widget, %{search: search, enabled: enabled})
       when is_boolean(enabled) do
    ids =
      network_id
      |> eligible_organizations_query(widget)
      |> where_search(search)
      |> select([organization: o], o.id)
      |> Repo.all()

    if enabled, do: {:ok, ids, []}, else: {:ok, [], ids}
  end

  defp resolve_changes(_network_id, _widget, changes) when is_map(changes) do
    with {:ok, enable} <- cast_uuids(Map.get(changes, :enable, [])),
         {:ok, disable} <- cast_uuids(Map.get(changes, :disable, [])) do
      if MapSet.disjoint?(MapSet.new(enable), MapSet.new(disable)) do
        {:ok, enable, disable}
      else
        {:error, :conflicting_changes}
      end
    end
  end

  defp validate_organizations(network_id, widget, ids) do
    ids = Enum.uniq(ids)

    found =
      network_id
      |> eligible_organizations_query(widget)
      |> where([organization: o], o.id in ^ids)
      |> Repo.aggregate(:count, :id)

    if found == length(ids), do: :ok, else: {:error, :organization_not_in_network}
  end

  # Stores the network's policy for the widget. A network widget restricted through
  # `widgets_organizations` is opened first: the network policy now decides.
  defp write_policy(network_id, widget, mode, organization_ids) do
    with :ok <- open_owner_restriction(widget) do
      from(nwo in NetworkWidgetOrganization,
        where:
          nwo.widget_id == ^widget.id and
            nwo.organization_id in subquery(network_organization_ids(network_id))
      )
      |> Repo.delete_all()

      now = DateTime.utc_now() |> DateTime.truncate(:second)

      if mode == "all" do
        from(p in NetworkWidgetPolicy,
          where: p.network_id == ^network_id and p.widget_id == ^widget.id
        )
        |> Repo.delete_all()
      else
        Repo.insert_all(
          NetworkWidgetPolicy,
          [
            %{
              network_id: network_id,
              widget_id: widget.id,
              mode: mode,
              inserted_at: now,
              updated_at: now
            }
          ],
          on_conflict: {:replace, [:mode, :updated_at]},
          conflict_target: [:network_id, :widget_id]
        )

        organization_ids
        |> Enum.map(
          &%{widget_id: widget.id, organization_id: &1, inserted_at: now, updated_at: now}
        )
        |> Enum.chunk_every(1000)
        |> Enum.each(&Repo.insert_all(NetworkWidgetOrganization, &1, on_conflict: :nothing))
      end

      :ok
    end
  end

  defp open_owner_restriction(%Widget{is_system: false, restricted: true} = widget) do
    from(wo in WidgetOrganization, where: wo.widget_id == ^widget.id) |> Repo.delete_all()

    case widget |> Widget.scope_changeset(%{restricted: false}) |> Repo.update() do
      {:ok, _} -> :ok
      {:error, changeset} -> {:error, {:invalid_widget, changeset}}
    end
  end

  defp open_owner_restriction(_widget), do: :ok

  # ===========================================================================
  # Access state
  # ===========================================================================

  # Network widgets restricted through `widgets_organizations` (owner restriction).
  defp state(_network_id, %Widget{is_system: false, restricted: true} = widget) do
    selected? =
      Repo.exists?(from(wo in WidgetOrganization, where: wo.widget_id == ^widget.id))

    %{mode: if(selected?, do: "selected", else: "hidden"), owner_restricted: true}
  end

  defp state(network_id, widget) do
    mode =
      from(p in NetworkWidgetPolicy,
        where: p.network_id == ^network_id and p.widget_id == ^widget.id,
        select: p.mode
      )
      |> Repo.one()

    %{mode: mode || "all", owner_restricted: false}
  end

  defp listed_query(widget, %{owner_restricted: true}) do
    from(wo in WidgetOrganization, where: wo.widget_id == ^widget.id, select: wo.organization_id)
  end

  defp listed_query(widget, _state) do
    from(nwo in NetworkWidgetOrganization,
      where: nwo.widget_id == ^widget.id,
      select: nwo.organization_id
    )
  end

  defp listed_ids(network_id, widget, state) do
    listed = listed_query(widget, state)

    network_id
    |> eligible_organizations_query(widget)
    |> where([organization: o], o.id in subquery(listed))
    |> select([organization: o], o.id)
    |> Repo.all()
  end

  defp enabled_ids_query(network_id, widget, state) do
    eligible = eligible_organizations_query(network_id, widget)
    listed = listed_query(widget, state)

    case state.mode do
      "all" -> eligible
      "selected" -> where(eligible, [organization: o], o.id in subquery(listed))
      "except" -> where(eligible, [organization: o], o.id not in subquery(listed))
      "hidden" -> where(eligible, [o], false)
    end
    |> select([organization: o], o.id)
  end

  defp enabled_ids(network_id, widget, state),
    do: network_id |> enabled_ids_query(widget, state) |> Repo.all()

  defp eligible_ids(network_id, widget) do
    network_id
    |> eligible_organizations_query(widget)
    |> select([organization: o], o.id)
    |> Repo.all()
  end

  # ===========================================================================
  # Queries
  # ===========================================================================

  # System widgets the platform offers to at least one organization of the network,
  # and the network's own widgets.
  defp managed_query(network_id) do
    platform_enabled = owner_enabled_widget_ids(network_id)

    from(w in Widget,
      as: :widget,
      where:
        (w.is_system == true and (w.restricted == false or w.id in subquery(platform_enabled))) or
          w.network_id == ^network_id
    )
  end

  defp get_managed_widget(network_id, widget_id) do
    with {:ok, network_id} <- Ecto.UUID.cast(network_id),
         {:ok, id} <- cast_widget_id(widget_id) do
      network_id |> managed_query() |> where([widget: w], w.id == ^id) |> Repo.one()
    else
      _ -> nil
    end
  end

  defp where_kind(query, "system"), do: where(query, [widget: w], w.is_system == true)
  defp where_kind(query, "network"), do: where(query, [widget: w], w.is_system == false)
  defp where_kind(query, _kind), do: query

  defp where_access(query, network_id, mode) when mode in @access_modes do
    policy = fn mode ->
      from(p in NetworkWidgetPolicy,
        where: p.network_id == ^network_id and p.mode == ^mode,
        select: p.widget_id
      )
    end

    any_policy =
      from(p in NetworkWidgetPolicy, where: p.network_id == ^network_id, select: p.widget_id)

    owner_enabled = owner_enabled_widget_ids(network_id)

    case mode do
      "all" ->
        where(
          query,
          [widget: w],
          (w.is_system == true or w.restricted == false) and w.id not in subquery(any_policy)
        )

      "except" ->
        where(
          query,
          [widget: w],
          (w.is_system == true or w.restricted == false) and
            w.id in subquery(policy.("except"))
        )

      "selected" ->
        where(
          query,
          [widget: w],
          ((w.is_system == true or w.restricted == false) and
             w.id in subquery(policy.("selected"))) or
            (w.is_system == false and w.restricted == true and w.id in subquery(owner_enabled))
        )

      "hidden" ->
        where(
          query,
          [widget: w],
          ((w.is_system == true or w.restricted == false) and
             w.id in subquery(policy.("hidden"))) or
            (w.is_system == false and w.restricted == true and
               w.id not in subquery(owner_enabled))
        )
    end
  end

  defp where_access(query, _network_id, _mode), do: query

  defp where_search(query, search) when is_binary(search) do
    case String.trim(search) do
      "" ->
        query

      term ->
        pattern = "%" <> String.replace(term, ~r/[\\%_]/, "\\\\\\0") <> "%"
        where(query, [q], ilike(q.name, ^pattern))
    end
  end

  defp where_search(query, _search), do: query

  # Widgets enabled through `widgets_organizations` for organizations of the network:
  # platform-restricted system widgets and owner-restricted network widgets.
  defp owner_enabled_widget_ids(network_id) do
    from(wo in WidgetOrganization,
      join: o in Organization,
      on: o.id == wo.organization_id,
      where: o.network_id == ^network_id,
      select: wo.widget_id
    )
  end

  defp network_organization_ids(network_id) do
    from(o in Organization, where: o.network_id == ^network_id, select: o.id)
  end

  # Organizations of the network that may use the widget: all of them, except for
  # system widgets restricted by the platform.
  defp eligible_organizations_query(network_id, %Widget{is_system: true, restricted: true} = w) do
    platform_enabled =
      from(wo in WidgetOrganization, where: wo.widget_id == ^w.id, select: wo.organization_id)

    from(o in Organization,
      as: :organization,
      where: o.network_id == ^network_id and o.id in subquery(platform_enabled)
    )
  end

  defp eligible_organizations_query(network_id, _widget) do
    from(o in Organization, as: :organization, where: o.network_id == ^network_id)
  end

  defp organizations_using(network_id, widget_id, organization_ids) do
    from(wc in WidgetConfig,
      join: pi in assoc(wc, :playlist_item),
      join: p in assoc(pi, :playlist),
      join: o in Organization,
      on: o.id == p.organization_id,
      where:
        wc.widget_id == ^widget_id and o.network_id == ^network_id and
          p.organization_id in ^organization_ids,
      distinct: true,
      select: p.organization_id
    )
    |> Repo.all()
  end

  defp organizations_count(network_id) do
    network_id |> network_organization_ids() |> Repo.aggregate(:count, :id)
  end

  # ===========================================================================
  # Summaries
  # ===========================================================================

  defp describe(_network_id, []), do: []

  defp describe(network_id, widgets) do
    ids = Enum.map(widgets, & &1.id)
    organizations_count = organizations_count(network_id)

    policies =
      from(p in NetworkWidgetPolicy,
        where: p.network_id == ^network_id and p.widget_id in ^ids,
        select: {p.widget_id, p.mode}
      )
      |> Repo.all()
      |> Map.new()

    # Listed organizations of the network that are eligible for the widget.
    listed =
      from(nwo in NetworkWidgetOrganization,
        join: o in Organization,
        on: o.id == nwo.organization_id,
        join: w in Widget,
        on: w.id == nwo.widget_id,
        left_join: wo in WidgetOrganization,
        on: wo.widget_id == nwo.widget_id and wo.organization_id == nwo.organization_id,
        where:
          o.network_id == ^network_id and nwo.widget_id in ^ids and
            (w.is_system == false or w.restricted == false or not is_nil(wo.widget_id)),
        group_by: nwo.widget_id,
        select: {nwo.widget_id, count(nwo.organization_id)}
      )
      |> Repo.all()
      |> Map.new()

    owner_enabled =
      network_id
      |> owner_enabled_widget_ids()
      |> exclude(:select)
      |> where([wo], wo.widget_id in ^ids)
      |> group_by([wo], wo.widget_id)
      |> select([wo], {wo.widget_id, count(wo.organization_id)})
      |> Repo.all()
      |> Map.new()

    in_use =
      from(wc in WidgetConfig,
        join: pi in assoc(wc, :playlist_item),
        join: p in assoc(pi, :playlist),
        join: o in Organization,
        on: o.id == p.organization_id,
        where: wc.widget_id in ^ids and o.network_id == ^network_id,
        group_by: wc.widget_id,
        select: {wc.widget_id, count(p.organization_id, :distinct)}
      )
      |> Repo.all()
      |> Map.new()

    Enum.map(widgets, fn widget ->
      platform_restricted = widget.is_system and widget.restricted
      owner_count = Map.get(owner_enabled, widget.id, 0)
      eligible = if platform_restricted, do: owner_count, else: organizations_count

      {access, listed_count} =
        if not widget.is_system and widget.restricted do
          {if(owner_count > 0, do: "selected", else: "hidden"), owner_count}
        else
          {Map.get(policies, widget.id, "all"), Map.get(listed, widget.id, 0)}
        end

      %{
        widget: widget,
        kind: if(widget.is_system, do: "system", else: "network"),
        access: access,
        listed_count: if(access in ["except", "selected"], do: listed_count, else: 0),
        enabled_count:
          case access do
            "all" -> eligible
            "except" -> max(eligible - listed_count, 0)
            "selected" -> listed_count
            "hidden" -> 0
          end,
        eligible_count: eligible,
        organizations_count: organizations_count,
        in_use_count: Map.get(in_use, widget.id, 0),
        core: core?(widget),
        platform_restricted: platform_restricted
      }
    end)
  end

  # ===========================================================================
  # Parameters
  # ===========================================================================

  defp pagination(params) do
    page = max(to_int(params[:page], 1), 1)
    page_size = params[:page_size] |> to_int(@default_page_size) |> max(1) |> min(@max_page_size)
    {page, page_size}
  end

  defp to_int(value, _default) when is_integer(value), do: value

  defp to_int(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {int, ""} -> int
      _ -> default
    end
  end

  defp to_int(_value, default), do: default

  defp cast_widget_id(id) when is_integer(id), do: {:ok, id}

  defp cast_widget_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {int, ""} -> {:ok, int}
      _ -> :error
    end
  end

  defp cast_widget_id(_id), do: :error

  defp cast_uuids(ids) when is_list(ids) do
    Enum.reduce_while(ids, {:ok, []}, fn id, {:ok, acc} ->
      case Ecto.UUID.cast(id) do
        {:ok, uuid} -> {:cont, {:ok, [uuid | acc]}}
        :error -> {:halt, {:error, :invalid_organization_id}}
      end
    end)
    |> case do
      {:ok, uuids} -> {:ok, uuids |> Enum.reverse() |> Enum.uniq()}
      error -> error
    end
  end

  defp cast_uuids(_ids), do: {:error, :invalid_organization_id}
end
