defmodule Castmill.Devices.Device do
  @behaviour Castmill.Behaviour.Filterable

  use Castmill.Schema

  import Ecto.Changeset
  import Ecto.Query, warn: false

  @primary_key {:id, :binary_id, autogenerate: true}

  @derive {Jason.Encoder,
           only: [
             :id,
             :name,
             :description,
             :last_ip,
             :last_online,
             :online,
             :loc_lat,
             :loc_long,
             :meta,
             :settings,
             :timezone,
             :user_agent,
             :version,
             :volume,
             :rc_last_heartbeat,
             :inserted_at,
             :updated_at
           ]}

  schema "devices" do
    field(:info, :map)
    field(:last_ip, :string)
    field(:last_online, :utc_datetime)
    field(:online, :boolean, default: false)
    field(:loc_lat, :float)
    field(:loc_long, :float)
    field(:meta, :map)
    field(:name, :string)
    field(:description, :string)
    field(:settings, :map)
    field(:timezone, :string)
    field(:user_agent, :string)
    field(:version, :string)
    field(:volume, :integer)
    field(:hardware_id, :string)
    field(:token_hash, :string)
    field(:mode, :string, default: "normal")
    field(:rc_last_heartbeat, :utc_datetime)

    field(:token, :string, virtual: true)

    belongs_to(:organization, Castmill.Organizations.Organization,
      foreign_key: :organization_id,
      type: Ecto.UUID
    )

    many_to_many(:channels, Castmill.Devices.DevicesChannels,
      join_through: "devices_channels",
      on_replace: :delete
    )

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [
      :name,
      :description,
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
      :organization_id
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
      :description,
      :last_ip,
      :token,
      :meta,
      :online,
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
      :organization_id
    ])
    |> put_pass_hash()
  end

  defp put_pass_hash(%Ecto.Changeset{valid?: true, changes: %{token: token}} = changeset) do
    change(changeset, add_hash(token, hash_key: :token_hash))
  end

  defp put_pass_hash(changeset), do: changeset

  def base_query() do
    from(device in Castmill.Devices.Device, as: :device)
  end

  defp add_hash(password, opts) do
    hash_key = opts[:hash_key] || :password_hash
    %{hash_key => Argon2.hash_pwd_salt(password, opts)}
  end

  @impl Castmill.Behaviour.Filterable
  # Filter by online status, however online is defined as having the online field set
  # to true and the last_online field being within the last minute
  def apply_filter({"online", true}) do
    dynamic([d], d.online == true and d.last_online > ago(1, "minute"))
  end

  # Offline is consider any device that has the online field set to false or the last_online
  # field being older than a minute
  def apply_filter({"offline", true}) do
    dynamic([d], d.online == false or d.last_online <= ago(1, "minute"))
  end

  def apply_filter(_) do
    # Return the query unchanged for unrecognized filters
    nil
  end
end
