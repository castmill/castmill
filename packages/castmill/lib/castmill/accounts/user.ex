defmodule Castmill.Accounts.User do
  use Castmill.Schema
  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, Ecto.UUID, autogenerate: true}

  @derive {Jason.Encoder,
           only: [
             :id,
             :avatar,
             :name,
             :email,
             :role,
             :blocked_at,
             :blocked_reason,
             :inserted_at,
             :updated_at
           ]}
  schema "users" do
    field(:avatar, :string)
    field(:email, :string)
    field(:name, :string)

    # Organization role (virtual, computed from organizations_users join table)
    field(:role, Ecto.Enum, values: [:admin, :manager, :member, :guest], virtual: true)

    # Blocking fields - when blocked_at is set, user cannot login
    field(:blocked_at, :utc_datetime_usec)
    field(:blocked_reason, :string)

    field(:meta, :map)

    many_to_many(
      :organizations,
      Castmill.Organizations.Organization,
      join_through: "organizations_users",
      on_replace: :delete
    )

    many_to_many(
      :networks,
      Castmill.Networks.Network,
      join_through: "networks_users",
      on_replace: :delete
    )

    has_many(:access_tokens, Castmill.Accounts.AccessToken)

    timestamps()
  end

  @doc false
  def changeset(user, attrs) do
    user
    |> cast(attrs, [:name, :avatar, :email])
    |> validate_required([:name, :email])
    |> validate_length(:name, min: 2, max: 50)
    |> validate_format(
      :avatar,
      ~r/^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/
    )
    |> validate_format(:email, ~r/@/)
    |> unique_constraint(:email, name: :users_email_index)
  end

  @doc """
  A user changeset for changing the password.

  ## Options

    * `:hash_password` - Hashes the password so it can be stored securely
      in the database and ensures the password field is cleared to prevent
      leaks in the logs. If password hashing is not needed and clearing the
      password field is not desired (like when using this changeset for
      validations on a LiveView form), this option can be set to `false`.
      Defaults to `true`.
  """
  def password_changeset(user, attrs, opts \\ []) do
    user
    |> cast(attrs, [:password])
    |> validate_confirmation(:password, message: "does not match password")
    |> validate_password(opts)
  end

  defp validate_password(changeset, _opts) do
    changeset
    |> validate_required([:password])
    |> validate_length(:password, min: 12, max: 256)

    # Examples of additional password validation:
    # |> validate_format(:password, ~r/[a-z]/, message: "at least one lower case character")
    # |> validate_format(:password, ~r/[A-Z]/, message: "at least one upper case character")
    # |> validate_format(:password, ~r/[!?@#$%^&*_0-9]/, message: "at least one digit or punctuation character")
    # |> maybe_hash_password(opts)
  end

  @doc """
  Changeset for blocking/unblocking a user.
  """
  def block_changeset(user, attrs) do
    user
    |> cast(attrs, [:blocked_at, :blocked_reason])
  end

  @doc """
  Returns true if the user is blocked.
  """
  def blocked?(%__MODULE__{blocked_at: nil}), do: false
  def blocked?(%__MODULE__{blocked_at: _}), do: true

  def base_query() do
    from(users in Castmill.Accounts.User, as: :user)
  end
end
