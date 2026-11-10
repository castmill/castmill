defmodule Castmill.Feeds.FeedToken do
  @moduledoc """
  A write token for one feed. Only a hash of the secret is stored; the secret is
  shown once when the token is created.
  """
  use Ecto.Schema
  import Ecto.Changeset

  @primary_key {:id, :binary_id, autogenerate: true}
  @foreign_key_type :binary_id

  @derive {Jason.Encoder,
           only: [:id, :feed_id, :name, :hint, :last_used_at, :revoked_at, :inserted_at]}
  schema "feed_tokens" do
    field(:name, :string)
    field(:secret_hash, :string)
    # Last characters of the secret, to tell tokens apart.
    field(:hint, :string)
    field(:last_used_at, :utc_datetime)
    field(:revoked_at, :utc_datetime)

    belongs_to(:feed, Castmill.Feeds.Feed)
    belongs_to(:created_by, Castmill.Accounts.User)

    timestamps()
  end

  @doc false
  def changeset(token, attrs) do
    token
    |> cast(attrs, [:name, :secret_hash, :hint, :feed_id, :created_by_id])
    |> update_change(:name, &String.trim/1)
    |> validate_required([:name, :secret_hash, :hint, :feed_id])
    |> validate_length(:name, max: 120)
    |> unique_constraint(:secret_hash)
  end
end
