defmodule Server.Device do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "devices" do
    field :account_id, :string
    field :last_ip, :string
    field :meta, :map
    field :name, :string
    field :token, :string

    belongs_to :organization, Server.Organization

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [:name, :last_ip, :token, :account_id, :meta])
    |> validate_required([:name, :last_ip, :token, :account_id, :meta])
  end
end
