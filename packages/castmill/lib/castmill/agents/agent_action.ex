defmodule Castmill.Agents.AgentAction do
  @moduledoc """
  Audit log entry describing an MCP tool call performed by an agent.
  """
  use Castmill.Schema
  import Ecto.Changeset

  @statuses ["success", "error"]

  @derive {Jason.Encoder,
           only: [
             :id,
             :agent_id,
             :organization_id,
             :tool,
             :arguments,
             :method,
             :path,
             :status,
             :http_status,
             :error,
             :duration_ms,
             :ip,
             :inserted_at
           ]}
  schema "agent_actions" do
    field(:tool, :string)
    field(:arguments, :map)
    field(:method, :string)
    field(:path, :string)
    field(:status, :string)
    field(:http_status, :integer)
    field(:error, :string)
    field(:duration_ms, :integer)
    field(:ip, :string)

    belongs_to(:agent, Castmill.Agents.Agent, type: Ecto.UUID)
    belongs_to(:organization, Castmill.Organizations.Organization, type: Ecto.UUID)

    timestamps(updated_at: false)
  end

  @doc false
  def changeset(action, attrs) do
    action
    |> cast(attrs, [
      :agent_id,
      :organization_id,
      :tool,
      :arguments,
      :method,
      :path,
      :status,
      :http_status,
      :error,
      :duration_ms,
      :ip
    ])
    |> validate_required([:agent_id, :organization_id, :tool, :status])
    |> validate_inclusion(:status, @statuses)
  end
end
