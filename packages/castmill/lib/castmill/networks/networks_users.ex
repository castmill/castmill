defmodule Castmill.Networks.NetworksUsers do
  use Ecto.Schema
  import Ecto.Changeset

  schema "networks_users" do
    field :access, {:array, :string}

    belongs_to :network, Castmill.Networks.Network, type: Ecto.UUID
    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(networks_users, attrs) do
    networks_users
    |> cast(attrs, [:access])
    |> validate_required([:access, :network_id, :user_id])
    |> unique_constraint([:network_id, :user_id])
  end
end
