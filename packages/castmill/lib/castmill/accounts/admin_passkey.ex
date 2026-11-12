defmodule Castmill.Accounts.AdminPasskey do
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, []}
  schema "admin_passkeys" do
    field :public_key, :binary
    field :sign_count, :integer, default: 0
    field :name, :string
    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID
    timestamps()
  end

  def changeset(passkey, attrs) do
    passkey
    |> cast(attrs, [:id, :user_id, :public_key, :sign_count, :name])
    |> validate_required([:id, :user_id, :public_key, :sign_count, :name])
    |> validate_length(:id, max: 1364)
    |> validate_length(:name, max: 80)
    |> unique_constraint(:id, name: :admin_passkeys_pkey)
  end
end
