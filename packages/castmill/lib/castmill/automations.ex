defmodule Castmill.Automations do
  @moduledoc """
  Automations: reusable, organization-scoped rules of the form "when an event
  happens, then do an action", assigned to devices and/or channels and
  evaluated on the devices.

  See `agents/systems/AUTOMATIONS.md` for the architecture.
  """

  import Ecto.Query, warn: false

  alias Castmill.Repo
  alias Castmill.Automations.{Automation, AutomationsDevices, AutomationsChannels, Registry, Rule}
  alias Castmill.Devices.{Device, DevicesChannels}
  alias Castmill.Resources.Channel

  @preview_max_count 50

  # ---------------------------------------------------------------------------
  # CRUD
  # ---------------------------------------------------------------------------

  @doc """
  Lists the automations of an organization. Supports `search`, `page` and
  `page_size`. Returns `{automations, count}`.
  """
  def list_automations(organization_id, params \\ %{}) do
    search = Map.get(params, "search") || Map.get(params, :search)
    page = to_positive_integer(Map.get(params, "page") || Map.get(params, :page), 1)

    page_size =
      to_positive_integer(Map.get(params, "page_size") || Map.get(params, :page_size), 100)
      |> min(500)

    query =
      Automation.base_query()
      |> where([a], a.organization_id == ^organization_id)
      |> maybe_search(search)

    count = Repo.aggregate(query, :count)

    automations =
      query
      |> order_by([a], asc: a.name, asc: a.id)
      |> limit(^page_size)
      |> offset(^((page - 1) * page_size))
      |> Repo.all()
      |> preload_assignments()

    {automations, count}
  end

  defp maybe_search(query, search) when is_binary(search) and search != "" do
    case Automation.apply_filter({"search", search}) do
      nil -> query
      dynamic -> where(query, ^dynamic)
    end
  end

  defp maybe_search(query, _search), do: query

  @doc "Gets an automation of an organization, or nil."
  def get_automation(organization_id, id) do
    with {:ok, id} <- parse_id(id),
         %Automation{} = automation <-
           Repo.get_by(Automation, id: id, organization_id: organization_id) do
      preload_assignments(automation)
    else
      _ -> nil
    end
  end

  @doc "Gets an automation by id (any organization), or nil."
  def get_automation(id) do
    case parse_id(id) do
      {:ok, id} -> Repo.get(Automation, id)
      _ -> nil
    end
  end

  def preload_assignments(automations) do
    Repo.preload(automations,
      automations_devices: [:device],
      automations_channels: [:channel]
    )
  end

  @doc """
  Creates an automation. Enforces the `automations` and `automation_rules`
  quotas.
  """
  def create_automation(organization_id, attrs) do
    changeset =
      Automation.changeset(
        %Automation{},
        Map.put(stringify_keys(attrs), "organization_id", organization_id)
      )

    with :ok <- check_automations_quota(organization_id),
         :ok <- check_references(organization_id, changeset),
         :ok <- check_rules_quota(organization_id, changeset, 0),
         {:ok, automation} <- Repo.insert(changeset) do
      {:ok, preload_assignments(automation)}
    end
  end

  @doc """
  Updates an automation and notifies the affected devices.
  """
  def update_automation(%Automation{} = automation, attrs) do
    attrs = stringify_keys(attrs) |> Map.drop(["organization_id"])
    changeset = Automation.changeset(automation, attrs)

    with :ok <- check_references(automation.organization_id, changeset),
         :ok <-
           check_rules_quota(automation.organization_id, changeset, length(automation.rules)),
         {:ok, updated} <- Repo.update(changeset) do
      notify_devices(affected_device_ids(updated))
      {:ok, preload_assignments(updated)}
    end
  end

  @doc "Deletes an automation and notifies the devices that used it."
  def delete_automation(%Automation{} = automation) do
    device_ids = affected_device_ids(automation)

    with {:ok, deleted} <- Repo.delete(automation) do
      notify_devices(device_ids)
      {:ok, deleted}
    end
  end

  defp check_automations_quota(organization_id) do
    used =
      Repo.aggregate(
        from(a in Automation, where: a.organization_id == ^organization_id),
        :count
      )

    if used < Castmill.Quotas.get_quota_for_organization(organization_id, :automations),
      do: :ok,
      else: {:error, :quota_exceeded}
  end

  defp check_rules_quota(organization_id, changeset, previous_rules) do
    case Ecto.Changeset.fetch_change(changeset, :rules) do
      {:ok, rules} ->
        used = rules_used(organization_id) - previous_rules
        max = Castmill.Quotas.get_quota_for_organization(organization_id, :automation_rules)

        if length(rules) == 0 or used + length(rules) <= max,
          do: :ok,
          else: {:error, :rules_quota_exceeded}

      :error ->
        :ok
    end
  end

  @doc "Total number of rules in the automations of an organization."
  def rules_used(organization_id) do
    from(a in Automation,
      where: a.organization_id == ^organization_id,
      select: coalesce(sum(fragment("jsonb_array_length(?)", a.rules)), 0)
    )
    |> Repo.one()
    |> to_integer()
  end

  defp to_integer(%Decimal{} = value), do: Decimal.to_integer(value)
  defp to_integer(value) when is_integer(value), do: value
  defp to_integer(_), do: 0

  # ---------------------------------------------------------------------------
  # Assignments
  # ---------------------------------------------------------------------------

  @doc """
  Replaces the device and channel assignments of an automation. All devices
  and channels must belong to the automation's organization.

  `position` orders the automations of each device (or channel): existing
  assignments keep their position and new ones are appended after the
  automations already assigned to that device (or channel). Notifies
  previously and newly affected devices.
  """
  def set_assignments(%Automation{} = automation, device_ids, channel_ids) do
    device_ids =
      device_ids
      |> List.wrap()
      |> Enum.map(fn id ->
        case Ecto.UUID.cast(to_string(id)) do
          {:ok, uuid} -> uuid
          :error -> to_string(id)
        end
      end)
      |> Enum.uniq()

    with {:ok, channel_ids} <- parse_ids(List.wrap(channel_ids)),
         channel_ids = Enum.uniq(channel_ids),
         :ok <- validate_devices(automation.organization_id, device_ids),
         :ok <- validate_channels(automation.organization_id, channel_ids) do
      before = affected_device_ids(automation)

      {:ok, _} =
        Repo.transaction(fn ->
          replace_assignments(AutomationsDevices, :device_id, automation.id, device_ids)
          replace_assignments(AutomationsChannels, :channel_id, automation.id, channel_ids)
        end)

      automation = Repo.get!(Automation, automation.id)
      notify_devices(Enum.uniq(before ++ affected_device_ids(automation)))
      {:ok, preload_assignments(automation)}
    end
  end

  defp replace_assignments(schema, key, automation_id, target_ids) do
    now = DateTime.utc_now() |> DateTime.truncate(:second)

    existing =
      from(a in schema,
        where: a.automation_id == ^automation_id,
        select: {field(a, ^key), a.position}
      )
      |> Repo.all()
      |> Map.new()

    removed = Map.keys(existing) -- target_ids

    if removed != [] do
      from(a in schema,
        where: a.automation_id == ^automation_id and field(a, ^key) in ^removed
      )
      |> Repo.delete_all()
    end

    new_ids = Enum.reject(target_ids, &Map.has_key?(existing, &1))

    if new_ids != [] do
      max_positions =
        from(a in schema,
          where: field(a, ^key) in ^new_ids,
          group_by: field(a, ^key),
          select: {field(a, ^key), max(a.position)}
        )
        |> Repo.all()
        |> Map.new()

      Repo.insert_all(
        schema,
        Enum.map(new_ids, fn id ->
          %{
            :automation_id => automation_id,
            key => id,
            :position => Map.get(max_positions, id, -1) + 1,
            :inserted_at => now,
            :updated_at => now
          }
        end)
      )
    end
  end

  defp validate_devices(_organization_id, []), do: :ok

  defp validate_devices(organization_id, device_ids) do
    with true <- Enum.all?(device_ids, &match?({:ok, _}, Ecto.UUID.cast(&1))),
         count when count == length(device_ids) <-
           Repo.aggregate(
             from(d in Device,
               where: d.id in ^device_ids and d.organization_id == ^organization_id
             ),
             :count
           ) do
      :ok
    else
      _ -> {:error, :invalid_assignment}
    end
  end

  defp validate_channels(_organization_id, []), do: :ok

  defp validate_channels(organization_id, channel_ids) do
    channel_ids = Enum.uniq(channel_ids)

    count =
      Repo.aggregate(
        from(c in Channel, where: c.id in ^channel_ids and c.organization_id == ^organization_id),
        :count
      )

    if count == length(channel_ids), do: :ok, else: {:error, :invalid_assignment}
  end

  @doc """
  Ids of the devices affected by an automation: assigned directly or through
  one of its channels.
  """
  def affected_device_ids(%Automation{id: id}), do: affected_device_ids(id)

  def affected_device_ids(automation_id) do
    direct =
      from(ad in AutomationsDevices,
        where: ad.automation_id == ^automation_id,
        select: ad.device_id
      )
      |> Repo.all()

    via_channels =
      from(ac in AutomationsChannels,
        join: dc in DevicesChannels,
        on: dc.channel_id == ac.channel_id,
        where: ac.automation_id == ^automation_id,
        select: dc.device_id
      )
      |> Repo.all()

    Enum.uniq(direct ++ via_channels)
  end

  # ---------------------------------------------------------------------------
  # Effective automations and device payload
  # ---------------------------------------------------------------------------

  @doc """
  The effective automations of a device: those assigned to it (by position),
  then those assigned to the channels it plays (channels in assignment order,
  then position), deduplicated. Each element is `{automation, via}` where
  `via` is a list of `%{type: "device"}` / `%{type: "channel", id, name}`.

  Options: `include_disabled: true` to also return disabled automations.
  """
  def effective_automations(device_id, opts \\ []) do
    include_disabled = Keyword.get(opts, :include_disabled, false)

    direct =
      from(ad in AutomationsDevices,
        join: a in Automation,
        on: a.id == ad.automation_id,
        where: ad.device_id == ^device_id,
        order_by: [asc: ad.position, asc: a.id],
        select: a
      )
      |> maybe_only_enabled(include_disabled)
      |> Repo.all()
      |> Enum.map(&{&1, nil})

    via_channels =
      from(dc in DevicesChannels,
        join: c in Channel,
        on: c.id == dc.channel_id,
        join: ac in AutomationsChannels,
        on: ac.channel_id == dc.channel_id,
        join: a in Automation,
        on: a.id == ac.automation_id,
        where: dc.device_id == ^device_id,
        order_by: [asc: dc.inserted_at, asc: dc.channel_id, asc: ac.position, asc: a.id],
        select: {a, c}
      )
      |> maybe_only_enabled(include_disabled)
      |> Repo.all()

    (direct ++ via_channels)
    |> Enum.reduce({[], %{}}, fn {automation, channel}, {order, vias} ->
      via =
        if channel,
          do: %{type: "channel", id: channel.id, name: channel.name, timezone: channel.timezone},
          else: %{type: "device"}

      if Map.has_key?(vias, automation.id) do
        {order, Map.update!(vias, automation.id, &(&1 ++ [via]))}
      else
        {[automation | order], Map.put(vias, automation.id, [via])}
      end
    end)
    |> then(fn {order, vias} ->
      order |> Enum.reverse() |> Enum.map(&{&1, Map.fetch!(vias, &1.id)})
    end)
  end

  defp maybe_only_enabled(query, true), do: query

  defp maybe_only_enabled(query, false) do
    where(query, [..., a], a.enabled == true)
  end

  @doc """
  Builds the payload a device needs to evaluate its effective automations:
  each rule with its source payload (for clock: UTC occurrences for the next
  14 days) and the resources its action references.
  """
  def device_payload(%Device{} = device, now \\ DateTime.utc_now()) do
    now = DateTime.truncate(now, :second)
    to = DateTime.add(now, Castmill.Automations.Sources.Clock.payload_days() * 86_400, :second)
    device_timezone = valid_timezone(device.timezone)

    automations =
      device.id
      |> effective_automations()
      |> Enum.map(fn {automation, via} ->
        default_timezone = default_timezone(device_timezone, via)

        rules =
          automation.rules
          |> Enum.with_index()
          |> Enum.flat_map(fn {rule, index} ->
            case device_rule(rule, index, %{timezone: default_timezone, from: now, to: to}) do
              nil -> []
              device_rule -> [device_rule]
            end
          end)

        %{
          "id" => automation.id,
          "name" => automation.name,
          "via" => Enum.map(via, &Map.take(&1, [:type, :id, :name])),
          "rules" => rules
        }
      end)

    %{
      "generated_at" => DateTime.to_unix(now, :millisecond),
      "valid_until" => DateTime.to_unix(to, :millisecond),
      "timezone" => device_timezone || "Etc/UTC",
      "automations" => automations
    }
  end

  defp default_timezone(nil, via) do
    Enum.find_value(via, fn
      %{type: "channel", timezone: tz} -> valid_timezone(tz)
      _ -> nil
    end) || "Etc/UTC"
  end

  defp default_timezone(device_timezone, _via), do: device_timezone

  @doc """
  The device representation of a rule (see `agents/systems/AUTOMATIONS.md`).
  Returns nil when its source or action is not registered.
  """
  def device_rule(rule, index, context) do
    with %{"when" => when_part, "then" => then_part} <- rule,
         source when not is_nil(source) <- Registry.source(when_part["source"]),
         action when not is_nil(action) <- Registry.action(then_part["action"]),
         kind when not is_nil(kind) <- Registry.condition_kind(source, when_part["condition"]) do
      %{
        "id" => rule["id"],
        "index" => index,
        "source" => when_part["source"],
        "condition" => when_part["condition"],
        "kind" => Atom.to_string(kind),
        "source_payload" => source.device_payload(when_part["config"], context),
        "action" => then_part["action"],
        "action_config" => then_part["config"],
        "cooldown_seconds" => rule["cooldown_seconds"] || 0,
        "resources" => action.referenced_resources(then_part["config"])
      }
    else
      _ -> nil
    end
  end

  defp valid_timezone(timezone) when is_binary(timezone) and timezone != "" do
    case DateTime.shift_zone(DateTime.utc_now(), timezone) do
      {:ok, _} -> timezone
      _ -> nil
    end
  end

  defp valid_timezone(_), do: nil

  @doc """
  Whether a playlist is referenced by one of the device's effective
  automations (grants the device access to fetch it).
  """
  def device_references_playlist?(device_id, playlist_id) do
    case parse_id(playlist_id) do
      {:ok, playlist_id} ->
        device_id
        |> effective_automations()
        |> Enum.any?(fn {automation, _via} ->
          playlist_id in Rule.referenced_playlist_ids(automation.rules)
        end)

      _ ->
        false
    end
  end

  # ---------------------------------------------------------------------------
  # Referential integrity
  # ---------------------------------------------------------------------------

  @doc """
  Automations (enabled or not) of an organization whose rules reference the
  playlist, as reported by each action's `referenced_resources/1`.
  """
  def automations_referencing_playlist(organization_id, playlist_id) do
    case parse_id(playlist_id) do
      {:ok, playlist_id} ->
        from(a in Automation, where: a.organization_id == ^organization_id)
        |> Repo.all()
        |> Enum.filter(&(playlist_id in Rule.referenced_playlist_ids(&1.rules)))

      _ ->
        []
    end
  end

  @doc "Whether any automation of the organization references the playlist."
  def playlist_referenced?(organization_id, playlist_id),
    do: automations_referencing_playlist(organization_id, playlist_id) != []

  # Referenced playlists must belong to the automation's organization.
  defp check_references(organization_id, changeset) do
    case Ecto.Changeset.fetch_change(changeset, :rules) do
      {:ok, rules} when changeset.valid? ->
        playlist_ids = Rule.referenced_playlist_ids(rules)

        found =
          if playlist_ids == [],
            do: 0,
            else:
              Repo.aggregate(
                from(p in Castmill.Resources.Playlist,
                  where: p.id in ^playlist_ids and p.organization_id == ^organization_id
                ),
                :count
              )

        if found == length(playlist_ids),
          do: :ok,
          else:
            {:error,
             Ecto.Changeset.add_error(
               changeset,
               :rules,
               "references a playlist that does not exist"
             )}

      _ ->
        :ok
    end
  end

  # ---------------------------------------------------------------------------
  # Notifications
  # ---------------------------------------------------------------------------

  @doc "Sends `automations_updated` to the given devices."
  def notify_devices(device_ids) do
    Enum.each(Enum.uniq(device_ids), fn device_id ->
      Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device_id}", %{
        event: "automations_updated"
      })
    end)
  end

  @doc "Notifies the devices whose automations reference a changed playlist."
  def notify_playlist_changed(organization_id, playlist_id) do
    organization_id
    |> automations_referencing_playlist(playlist_id)
    |> Enum.filter(& &1.enabled)
    |> Enum.flat_map(&affected_device_ids/1)
    |> notify_devices()
  end

  @doc """
  Notifies a device when a channel with automations is added to or removed
  from it.
  """
  def notify_channel_membership_changed(device_id, channel_id) do
    case parse_id(channel_id) do
      {:ok, channel_id} ->
        if Repo.exists?(from(ac in AutomationsChannels, where: ac.channel_id == ^channel_id)) do
          notify_devices([device_id])
        end

        :ok

      _ ->
        :ok
    end
  end

  @doc """
  "Run now": sends a rule's action to the online devices affected by the
  automation. Returns `{:ok, count}` with the number of devices notified.
  """
  def run_rule(%Automation{} = automation, rule_id) do
    case Enum.find_index(automation.rules, &(&1["id"] == rule_id)) do
      nil ->
        {:error, :not_found}

      index ->
        rule = Enum.at(automation.rules, index)
        now = DateTime.utc_now()

        case device_rule(rule, index, %{timezone: "Etc/UTC", from: now, to: now}) do
          nil ->
            {:error, :not_found}

          device_rule ->
            device_ids = online_device_ids(affected_device_ids(automation))

            Enum.each(device_ids, fn device_id ->
              Phoenix.PubSub.broadcast(Castmill.PubSub, "devices:#{device_id}", %{
                event: "automation_run",
                automation_id: automation.id,
                rule: device_rule
              })
            end)

            {:ok, length(device_ids)}
        end
    end
  end

  defp online_device_ids([]), do: []

  defp online_device_ids(device_ids) do
    from(d in Device, where: d.id in ^device_ids and d.online == true, select: d.id)
    |> Repo.all()
  end

  # ---------------------------------------------------------------------------
  # Dashboard helpers
  # ---------------------------------------------------------------------------

  @doc """
  Previews the next `count` occurrences of a `when` part (sources with
  `upcoming/4`). Returns `{:ok, %{timezone, occurrences}}`.
  """
  def preview(when_part, timezone, count, now \\ DateTime.utc_now()) do
    count = count |> to_positive_integer(10) |> min(@preview_max_count)

    with {:ok, when_part, _kind} <- Rule.validate_when(Rule.stringify(when_part || %{})) do
      source = Registry.source(when_part["source"])

      timezone =
        valid_timezone(when_part["config"]["timezone"]) || valid_timezone(timezone) || "Etc/UTC"

      {:ok,
       %{
         timezone: timezone,
         occurrences: upcoming(source, when_part["config"], timezone, now, count)
       }}
    end
  end

  defp upcoming(source, config, timezone, now, count) do
    if function_exported?(source, :upcoming, 4) do
      source.upcoming(config, timezone, now, count)
    else
      []
    end
  end

  @doc """
  The next firing of an automation (earliest across its rules), using the
  rule timezone, else the first assigned channel's, else the first assigned
  device's, else UTC. Expects preloaded assignments.
  """
  def next_firing(%Automation{enabled: false}, _now), do: nil

  def next_firing(%Automation{} = automation, now) do
    timezone = automation_timezone(automation)

    automation.rules
    |> Enum.flat_map(fn rule ->
      source = Registry.source(get_in(rule, ["when", "source"]))

      if source do
        upcoming(source, get_in(rule, ["when", "config"]), timezone, now, 1)
      else
        []
      end
    end)
    |> Enum.min(DateTime, fn -> nil end)
  end

  defp automation_timezone(%Automation{} = automation) do
    channels = loaded(automation.automations_channels)
    devices = loaded(automation.automations_devices)

    Enum.find_value(channels, fn ac -> ac.channel && valid_timezone(ac.channel.timezone) end) ||
      Enum.find_value(devices, fn ad -> ad.device && valid_timezone(ad.device.timezone) end) ||
      "Etc/UTC"
  end

  defp loaded(%Ecto.Association.NotLoaded{}), do: []
  defp loaded(nil), do: []
  defp loaded(list), do: list

  @doc """
  Capability warnings: assigned devices (directly or through channels) whose
  reported capabilities lack a rule's required source or action.
  """
  def warnings(%Automation{} = automation) do
    device_ids = affected_device_ids(automation)

    devices =
      if device_ids == [],
        do: [],
        else: Repo.all(from(d in Device, where: d.id in ^device_ids, order_by: d.name))

    for device <- devices,
        rule <- automation.rules,
        missing <- missing_capabilities(device, rule) do
      %{rule_id: rule["id"], device_id: device.id, device_name: device.name, missing: missing}
    end
  end

  defp missing_capabilities(device, rule) do
    capabilities = get_in(device.info || %{}, ["capabilities"]) || %{}
    %{source: source_cap, action: action_cap} = Rule.required_capabilities(rule)

    [
      {"automation_sources", source_cap},
      {"automation_actions", action_cap}
    ]
    |> Enum.flat_map(fn {key, cap} ->
      supported = Map.get(capabilities, key)

      if is_binary(cap) and not (is_list(supported) and cap in supported),
        do: ["#{key}:#{cap}"],
        else: []
    end)
  end

  @doc "JSON representation for the dashboard."
  def to_json(%Automation{} = automation, now \\ DateTime.utc_now()) do
    automation = preload_assignments(automation)

    %{
      id: automation.id,
      name: automation.name,
      enabled: automation.enabled,
      organization_id: automation.organization_id,
      rules: automation.rules,
      inserted_at: automation.inserted_at,
      updated_at: automation.updated_at,
      devices:
        Enum.map(automation.automations_devices, fn %{device: d} ->
          %{id: d.id, name: d.name, online: d.online, timezone: d.timezone}
        end),
      channels:
        Enum.map(automation.automations_channels, fn %{channel: c} ->
          %{id: c.id, name: c.name, timezone: c.timezone}
        end),
      next_firing: next_firing(automation, now),
      warnings: warnings(automation)
    }
  end

  @doc """
  Automations assigned to a channel, each with its clock occurrences in the
  channel timezone between `from` and `to` (for calendar markers).
  """
  def channel_automations(%Channel{} = channel, from, to) do
    timezone = valid_timezone(channel.timezone) || "Etc/UTC"

    from(ac in AutomationsChannels,
      join: a in Automation,
      on: a.id == ac.automation_id,
      where: ac.channel_id == ^channel.id,
      order_by: [asc: ac.position, asc: a.id],
      select: a
    )
    |> Repo.all()
    |> Enum.map(fn automation ->
      occurrences =
        if automation.enabled do
          Enum.flat_map(automation.rules, fn rule ->
            source = Registry.source(get_in(rule, ["when", "source"]))

            if source && function_exported?(source, :occurrences, 4) do
              rule
              |> get_in(["when", "config"])
              |> source.occurrences(timezone, from, to)
              |> Enum.map(&%{rule_id: rule["id"], at: &1})
            else
              []
            end
          end)
          |> Enum.sort_by(& &1.at, DateTime)
        else
          []
        end

      %{
        id: automation.id,
        name: automation.name,
        enabled: automation.enabled,
        rules: automation.rules,
        occurrences: occurrences
      }
    end)
  end

  # ---------------------------------------------------------------------------
  # Helpers
  # ---------------------------------------------------------------------------

  defp stringify_keys(attrs) when is_map(attrs) do
    Map.new(attrs, fn {key, value} -> {to_string(key), value} end)
  end

  defp stringify_keys(_attrs), do: %{}

  defp parse_id(id) when is_integer(id), do: {:ok, id}

  defp parse_id(id) when is_binary(id) do
    case Integer.parse(id) do
      {parsed, ""} -> {:ok, parsed}
      _ -> :error
    end
  end

  defp parse_id(_), do: :error

  defp parse_ids(ids) do
    Enum.reduce_while(ids, {:ok, []}, fn id, {:ok, acc} ->
      case parse_id(id) do
        {:ok, parsed} -> {:cont, {:ok, acc ++ [parsed]}}
        :error -> {:halt, {:error, :invalid_assignment}}
      end
    end)
  end

  defp to_positive_integer(value, _default) when is_integer(value) and value > 0, do: value

  defp to_positive_integer(value, default) when is_binary(value) do
    case Integer.parse(value) do
      {parsed, ""} when parsed > 0 -> parsed
      _ -> default
    end
  end

  defp to_positive_integer(_value, default), do: default
end
