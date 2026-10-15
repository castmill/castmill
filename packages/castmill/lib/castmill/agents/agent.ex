defmodule Castmill.Agents.Agent do
  @moduledoc """
  An AI agent that is a member of an organization.

  Every agent is backed by a `Castmill.Accounts.User` (with `is_agent: true`)
  that holds the agent's organization membership and role. Authorization is
  therefore performed exactly as for regular users.

  The agent credential is never stored in clear text: only its SHA-256 hash and
  a short, non-secret prefix (used to identify the credential in the UI).
  """
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key {:id, Ecto.UUID, autogenerate: true}

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :description,
             :role,
             :organization_id,
             :user_id,
             :created_by_id,
             :has_credentials,
             :secret_prefix,
             :credential_rotated_at,
             :last_used_at,
             :last_ip,
             :inserted_at,
             :updated_at
           ]}
  schema "agents" do
    field(:name, :string)
    field(:description, :string)

    field(:secret_hash, :string, redact: true)
    field(:secret_prefix, :string)
    field(:credential_rotated_at, :utc_datetime)
    field(:last_used_at, :utc_datetime)
    field(:last_ip, :string)

    # Virtual fields computed when listing agents
    field(:role, Ecto.Enum,
      values: [:admin, :manager, :member, :editor, :publisher, :device_manager, :guest],
      virtual: true
    )

    field(:has_credentials, :boolean, virtual: true, default: false)

    belongs_to(:user, Castmill.Accounts.User, type: Ecto.UUID)
    belongs_to(:organization, Castmill.Organizations.Organization, type: Ecto.UUID)
    belongs_to(:created_by, Castmill.Accounts.User, type: Ecto.UUID)

    has_many(:actions, Castmill.Agents.AgentAction)

    timestamps()
  end

  @doc false
  def changeset(agent, attrs) do
    agent
    |> cast(attrs, [:name, :description])
    |> update_change(:name, &String.trim/1)
    |> validate_required([:name])
    |> validate_length(:name, min: 2, max: 50)
    |> validate_length(:description, max: 1000)
  end

  @doc false
  def create_changeset(agent, attrs) do
    agent
    |> changeset(attrs)
    |> cast(attrs, [:user_id, :organization_id, :created_by_id])
    |> validate_required([:user_id, :organization_id])
  end

  @doc false
  def credential_changeset(agent, attrs) do
    agent
    |> cast(attrs, [:secret_hash, :secret_prefix, :credential_rotated_at])
    |> unique_constraint(:secret_hash)
  end
end
