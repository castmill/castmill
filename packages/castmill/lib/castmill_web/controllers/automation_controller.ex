defmodule CastmillWeb.AutomationController do
  @moduledoc """
  Dashboard endpoints to manage the automations of an organization: CRUD,
  assignments to devices and channels, "Run now", schedule previews and the
  registry of available event sources and actions.

  Uses the `automations` permission resource (same role matrix as channels).
  See `agents/systems/AUTOMATIONS.md`.
  """
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Automations
  alias Castmill.Automations.Registry
  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @permission_actions %{
    index: :list,
    registry: :list,
    preview: :list,
    channel_automations: :list,
    show: :show,
    create: :create,
    update: :update,
    assign: :update,
    run_rule: :update,
    delete: :delete
  }

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, :channel_automations, %{
        "organization_id" => organization_id,
        "channel_id" => channel_id
      }) do
    channel = Castmill.Resources.get_channel(channel_id)

    {:ok,
     not is_nil(channel) and channel.organization_id == organization_id and
       Organizations.has_access(organization_id, actor_id, "automations", :list)}
  end

  def check_access(actor_id, action, %{"organization_id" => organization_id}) do
    case Map.get(@permission_actions, action) do
      nil ->
        {:ok, false}

      permission ->
        {:ok, Organizations.has_access(organization_id, actor_id, "automations", permission)}
    end
  end

  def check_access(_actor_id, _action, _params), do: {:ok, false}

  plug(AuthorizeDash)

  def index(conn, %{"organization_id" => organization_id} = params) do
    {automations, count} = Automations.list_automations(organization_id, params)
    now = DateTime.utc_now()
    json(conn, %{data: Enum.map(automations, &Automations.to_json(&1, now)), count: count})
  end

  def registry(conn, _params) do
    json(conn, %{data: Registry.describe()})
  end

  def preview(conn, params) do
    case Automations.preview(params["when"], params["timezone"], params["count"] || 10) do
      {:ok, %{timezone: timezone, occurrences: occurrences}} ->
        json(conn, %{data: %{timezone: timezone, occurrences: occurrences}})

      {:error, message} ->
        conn
        |> put_status(:unprocessable_entity)
        |> json(%{errors: %{when: [message]}})
    end
  end

  def show(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, automation} <- fetch(organization_id, id) do
      json(conn, %{data: Automations.to_json(automation)})
    end
  end

  def create(conn, %{"organization_id" => organization_id} = params) do
    attrs = Map.get(params, "automation", Map.take(params, ["name", "enabled", "rules"]))

    case Automations.create_automation(organization_id, attrs) do
      {:ok, automation} ->
        conn
        |> put_status(:created)
        |> json(%{data: Automations.to_json(automation)})

      error ->
        handle_error(conn, error)
    end
  end

  def update(conn, %{"organization_id" => organization_id, "id" => id} = params) do
    attrs = Map.get(params, "automation", Map.take(params, ["name", "enabled", "rules"]))

    with {:ok, automation} <- fetch(organization_id, id) do
      case Automations.update_automation(
             automation,
             Map.take(attrs, ["name", "enabled", "rules"])
           ) do
        {:ok, automation} -> json(conn, %{data: Automations.to_json(automation)})
        error -> handle_error(conn, error)
      end
    end
  end

  def delete(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, automation} <- fetch(organization_id, id),
         {:ok, _} <- Automations.delete_automation(automation) do
      send_resp(conn, :no_content, "")
    end
  end

  def assign(conn, %{"organization_id" => organization_id, "automation_id" => id} = params) do
    with {:ok, automation} <- fetch(organization_id, id) do
      case Automations.set_assignments(
             automation,
             Map.get(params, "devices", []),
             Map.get(params, "channels", [])
           ) do
        {:ok, automation} ->
          json(conn, %{data: Automations.to_json(automation)})

        {:error, :invalid_assignment} ->
          conn
          |> put_status(:unprocessable_entity)
          |> json(%{
            errors: %{assignments: ["contain devices or channels of another organization"]}
          })
      end
    end
  end

  def run_rule(conn, %{
        "organization_id" => organization_id,
        "automation_id" => id,
        "rule_id" => rule_id
      }) do
    with {:ok, automation} <- fetch(organization_id, id),
         {:ok, count} <- Automations.run_rule(automation, rule_id) do
      json(conn, %{data: %{devices: count}})
    end
  end

  def channel_automations(conn, %{"channel_id" => channel_id} = params) do
    channel = Castmill.Resources.get_channel(channel_id)
    now = DateTime.utc_now()
    from = parse_datetime(params["from"]) || now
    to = parse_datetime(params["to"]) || DateTime.add(from, 7 * 86_400, :second)
    # Bound the expansion to at most 62 days.
    to = Enum.min([to, DateTime.add(from, 62 * 86_400, :second)], DateTime)

    json(conn, %{data: Automations.channel_automations(channel, from, to)})
  end

  defp fetch(organization_id, id) do
    case Automations.get_automation(organization_id, id) do
      nil -> {:error, :not_found}
      automation -> {:ok, automation}
    end
  end

  defp handle_error(conn, {:error, :quota_exceeded}) do
    conn
    |> put_status(:forbidden)
    |> json(%{errors: %{quota: ["Automation quota exceeded"]}})
  end

  defp handle_error(conn, {:error, :rules_quota_exceeded}) do
    conn
    |> put_status(:forbidden)
    |> json(%{errors: %{quota: ["Automation rules quota exceeded"]}})
  end

  defp handle_error(conn, {:error, :automation_disabled}) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: %{automation: ["Cannot run a disabled automation"]}})
  end

  defp handle_error(_conn, error), do: error

  defp parse_datetime(value) when is_binary(value) do
    case DateTime.from_iso8601(value) do
      {:ok, datetime, _offset} -> datetime
      _ -> nil
    end
  end

  defp parse_datetime(_value), do: nil
end
