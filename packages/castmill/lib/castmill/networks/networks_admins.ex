defmodule Castmill.Networks.NetworksAdmins do
  use Castmill.Schema
  import Ecto.Changeset

  schema "networks_admins" do
    field :access, :string

    belongs_to :network, Castmill.Networks.Network, type: Ecto.UUID
    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(networks_admins, attrs) do
    networks_admins
    |> cast(attrs, [:access])
    |> validate_required([:access, :network_id, :user_id])
    |> unique_constraint([:network_id, :user_id])
  end
end
