defmodule Castmill.Devices.Device do
  use Ecto.Schema
  import Ecto.Changeset

  import Argon2

  @primary_key {:id, :binary_id, autogenerate: true}

  schema "devices" do
    field :info, :map
    field :last_ip, :string
    field :last_online, :date
    field :loc_lat, :float
    field :loc_long, :float
    field :meta, :map
    field :name, :string
    field :settings, :map
    field :timezone, :string
    field :user_agent, :string
    field :version, :string
    field :volume, :integer
    field :hardware_id, :string
    field :token_hash, :string

    field :token, :string, virtual: true

    belongs_to :organization, Castmill.Organizations.Organization, foreign_key: :organization_id, type: Ecto.UUID
    belongs_to :resource, Castmill.Resources.Resource, foreign_key: :resource_id

    many_to_many :calendars, Castmill.Devices.DevicesCalendars, join_through: "devices_calendars", on_replace: :delete

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [
      :name,
      :last_ip,
      :token,
      :meta,
      :last_online,
      :user_agent,
      :timezone,
      :loc_lat,
      :loc_long,
      :version,
      :settings,
      :volume,
      :info,
      :hardware_id,
      :organization_id,
      :resource_id
    ])
    |> put_pass_hash()
    |> validate_required([
      :name,
      :last_ip,
      :hardware_id,
      :organization_id,
      :token_hash,
      :user_agent,
      :timezone,
      :version
    ])
    |> unique_constraint(:hardware_id)
  end

  def update_changeset(device, attrs) do
    device
    |> cast(attrs, [
      :name,
      :last_ip,
      :token,
      :meta,
      :last_online,
      :user_agent,
      :timezone,
      :loc_lat,
      :loc_long,
      :version,
      :settings,
      :volume,
      :info,
      :hardware_id,
      :organization_id,
      :resource_id
    ])
    |> put_pass_hash()
  end

  defp put_pass_hash(%Ecto.Changeset{valid?: true, changes: %{token: token}} = changeset) do
    change(changeset, add_hash(token, hash_key: :token_hash))
  end

  defp put_pass_hash(changeset), do: changeset
end
