defmodule CastmillWeb.AgentController do
  @moduledoc """
  Dashboard endpoints to manage the AI agents of an organization and to
  inspect the actions they performed.

  - Admins and managers can list agents and view the activity log.
  - Only admins can create, update, delete agents and manage credentials.
  - Agents can never manage agents.
  """
  use CastmillWeb, :controller
  use CastmillWeb.AccessActorBehaviour

  alias Castmill.Agents
  alias Castmill.Organizations
  alias Castmill.Plug.AuthorizeDash

  action_fallback(CastmillWeb.FallbackController)

  @read_actions [:index, :show, :list_actions]

  @impl CastmillWeb.AccessActorBehaviour
  def check_access(actor_id, action, %{"organization_id" => organization_id}) do
    cond do
      Agents.agent_user?(actor_id) ->
        {:ok, false}

      action in @read_actions ->
        {:ok, Organizations.has_any_role?(organization_id, actor_id, [:admin, :manager])}

      true ->
        {:ok, Organizations.is_admin?(organization_id, actor_id)}
    end
  end

  def check_access(_actor_id, _action, _params), do: {:ok, false}

  plug(AuthorizeDash)

  def index(conn, %{"organization_id" => organization_id}) do
    json(conn, %{data: Agents.list_agents(organization_id)})
  end

  def show(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, agent} <- fetch_agent(organization_id, id) do
      json(conn, %{data: agent})
    end
  end

  def create(conn, %{"organization_id" => organization_id} = params) do
    attrs = Map.get(params, "agent", params)
    created_by_id = conn.assigns[:current_user] && conn.assigns[:current_user].id

    case Agents.create_agent(organization_id, attrs, created_by_id) do
      {:ok, agent, secret} ->
        conn
        |> put_status(:created)
        |> json(%{data: agent, secret: secret})

      {:error, :invalid_role} ->
        invalid_role(conn)

      error ->
        error
    end
  end

  def update(conn, %{"organization_id" => organization_id, "id" => id} = params) do
    attrs = Map.get(params, "agent", Map.take(params, ["name", "description", "role"]))

    with {:ok, agent} <- fetch_agent(organization_id, id) do
      case Agents.update_agent(agent, attrs) do
        {:ok, agent} -> json(conn, %{data: agent})
        {:error, :invalid_role} -> invalid_role(conn)
        error -> error
      end
    end
  end

  def delete(conn, %{"organization_id" => organization_id, "id" => id}) do
    with {:ok, agent} <- fetch_agent(organization_id, id),
         {:ok, _} <- Agents.delete_agent(agent) do
      send_resp(conn, :no_content, "")
    end
  end

  def rotate_credentials(conn, %{"organization_id" => organization_id, "agent_id" => id}) do
    with {:ok, agent} <- fetch_agent(organization_id, id),
         {:ok, agent, secret} <- Agents.rotate_credentials(agent) do
      json(conn, %{data: agent, secret: secret})
    end
  end

  def revoke_credentials(conn, %{"organization_id" => organization_id, "agent_id" => id}) do
    with {:ok, agent} <- fetch_agent(organization_id, id),
         {:ok, agent} <- Agents.revoke_credentials(agent) do
      json(conn, %{data: agent})
    end
  end

  def list_actions(conn, %{"organization_id" => organization_id} = params) do
    json(conn, Agents.list_actions(organization_id, params))
  end

  defp fetch_agent(organization_id, id) do
    case Agents.get_agent(organization_id, id) do
      nil -> {:error, :not_found}
      agent -> {:ok, agent}
    end
  end

  defp invalid_role(conn) do
    conn
    |> put_status(:unprocessable_entity)
    |> json(%{errors: %{role: ["is invalid"]}})
  end
end
