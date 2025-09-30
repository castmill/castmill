defmodule Castmill.Accounts.UserCredential do
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key {:id, :string, []}

  schema "users_credentials" do
    # DER-encoded Subject Public Key Info: https://datatracker.ietf.org/doc/html/rfc5280#section-4.1.2.7
    field(:public_key_spki, :binary)
    field(:device_name, :string)
    field(:browser, :string)
    field(:os, :string)
    field(:user_agent, :string)

    belongs_to(:user, Castmill.Accounts.User, type: Ecto.UUID)

    timestamps()
  end

  def changeset(credential, attrs) do
    credential
    |> cast(attrs, [:id, :public_key_spki, :user_id, :device_name, :browser, :os, :user_agent])
    |> validate_required([:id, :public_key_spki, :user_id])
  end
end
