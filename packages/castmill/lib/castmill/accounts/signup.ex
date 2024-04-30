# Description: This module is used to define the schema for the signups table.
# Signups are used to generate signup links that can then be used to create a
# new user account using Passkey authentication.
defmodule Castmill.Accounts.SignUp do
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, Ecto.UUID, autogenerate: true}

  schema "signups" do
    field(:email, :string)
    field(:challenge, :string)
    field(:status, Ecto.Enum, values: [:created, :sent, :registered, :failed], default: :created)

    field(:status_message, :string)

    belongs_to(:network, Castmill.Networks.Network, foreign_key: :network_id, type: Ecto.UUID)

    timestamps()
  end

  def changeset(signup, attrs) do
    signup
    |> cast(attrs, [:email, :challenge, :status, :status_message, :network_id])
    |> validate_required([:email, :challenge, :status, :network_id])
  end

  defimpl Jason.Encoder, for: Castmill.Accounts.SignUp do
    def encode(%Castmill.Accounts.SignUp{} = signup, opts) do
      %{
        email: signup.email,
        challenge: signup.challenge,
        status: signup.status,
        status_message: signup.status_message,
        inserted_at: signup.inserted_at,
        updated_at: signup.updated_at
      }
      |> Jason.Encode.map(opts)
    end
  end
end
