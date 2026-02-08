defmodule Castmill.Networks.NetworksUsers do
  use Castmill.Schema
  import Ecto.Changeset

  @moduledoc """
  Schema for the networks_users join table.

  This table links users to networks with a specific role:
  - :admin - Network administrator, can manage network settings
  - :member - Regular network member

  Note: Every user also has a `network_id` foreign key in the users table,
  indicating which network they belong to. This table is for explicit
  role assignments within a network.
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
