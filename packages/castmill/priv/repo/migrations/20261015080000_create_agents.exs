defmodule Castmill.Repo.Migrations.CreateAgents do
  use Ecto.Migration

  @moduledoc """
  Adds AI agents as organization members.

  An agent is backed by a regular `users` row (flagged with `is_agent`) that is
  a member of exactly one organization through `organizations_users`, so every
  authorization check that applies to users also applies to agents.

  - agents: agent metadata and its hashed MCP credential (rotatable/revocable)
  - agent_actions: audit log of every MCP tool call performed by an agent
  """

  def change do
    alter table(:users) do
      add :is_agent, :boolean, null: false, default: false
    end

    create table(:agents, primary_key: false) do
      add :id, :uuid, primary_key: true
      add :name, :string, null: false
      add :description, :text

      # SHA-256 hash of the current credential. NULL when revoked.
      add :secret_hash, :string
      # Non-secret prefix of the credential, shown in the UI to identify it.
      add :secret_prefix, :string
      add :credential_rotated_at, :utc_datetime
      add :last_used_at, :utc_datetime
      add :last_ip, :string

      add :user_id, references(:users, type: :uuid, on_delete: :delete_all), null: false

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false

      add :created_by_id, references(:users, type: :uuid, on_delete: :nilify_all)

      timestamps()
    end

    create index(:agents, [:organization_id])
    create unique_index(:agents, [:user_id])
    create unique_index(:agents, [:secret_hash])

    create table(:agent_actions) do
      add :agent_id, references(:agents, type: :uuid, on_delete: :delete_all), null: false

      add :organization_id, references(:organizations, type: :uuid, on_delete: :delete_all),
        null: false

      add :tool, :string, null: false
      add :arguments, :map
      add :method, :string
      add :path, :text
      add :status, :string, null: false
      add :http_status, :integer
      add :error, :text
      add :duration_ms, :integer
      add :ip, :string

      timestamps(updated_at: false)
    end

    create index(:agent_actions, [:organization_id, :inserted_at])
    create index(:agent_actions, [:agent_id, :inserted_at])
  end
end
