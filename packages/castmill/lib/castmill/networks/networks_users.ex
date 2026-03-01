defmodule Castmill.Networks.NetworksUsers do
  use Castmill.Schema
  import Ecto.Changeset

  @moduledoc """
  Schema for the networks_users join table.

  This is the **single source of truth** for user↔network membership.

  Roles:
  - :admin - Network administrator, can manage network settings
  - :member - Regular network member

  A user may belong to multiple networks (each with its own role).
  Every user must belong to at least one network.
  """

  schema "networks_users" do
    field :role, Ecto.Enum, values: [:admin, :member]

    belongs_to :network, Castmill.Networks.Network, type: Ecto.UUID
    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(networks_users, attrs) do
    networks_users
    |> cast(attrs, [:role, :network_id, :user_id])
    |> validate_required([:role, :network_id, :user_id])
    |> unique_constraint([:network_id, :user_id])
  end
end
