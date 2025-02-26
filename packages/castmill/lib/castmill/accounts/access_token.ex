defmodule Castmill.Accounts.AccessToken do
  use Castmill.Schema
  import Ecto.Changeset

  schema "access_tokens" do
    field :secret, :string, virtual: true
    field :secret_hash, :string
    field :accessed, :integer, default: 0
    field :accessed_at, :utc_datetime, default: DateTime.truncate(DateTime.utc_now(), :second)
    field :last_ip, :string
    field :is_root, :boolean, default: false

    belongs_to :user, Castmill.Accounts.User, type: Ecto.UUID

    timestamps()
  end

  @doc false
  def changeset(access_token, attrs) do
    access_token
    |> cast(attrs, [:secret, :user_id, :is_root])
    |> put_secret_hash()
    |> validate_required([:secret, :user_id])
  end

  defp put_secret_hash(changeset) do
    case changeset do
      %Ecto.Changeset{valid?: true, changes: %{secret: secret}} ->
        changeset
        |> put_change(:secret_hash, :crypto.hash(:sha256, secret) |> Base.encode16())

      _ ->
        changeset
    end
  end
end
