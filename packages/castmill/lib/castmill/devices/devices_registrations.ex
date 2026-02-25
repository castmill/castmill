defmodule Castmill.Devices.DevicesRegistrations do
  use Castmill.Schema
  import Ecto.Changeset

  @primary_key false

  schema "devices_registrations" do
    field :hardware_id, :string, primary_key: true
    field :pincode, :string
    field :device_ip, :string
    field :user_agent, :string
    field :version, :string
    field :expires_at, :utc_datetime

    field :timezone, :string
    field :loc_lat, :float
    field :loc_long, :float

    timestamps()
  end

  @doc false
  def changeset(device, attrs) do
    device
    |> cast(attrs, [
      :pincode,
      :hardware_id,
      :device_ip,
      :user_agent,
      :version,
      :timezone,
      :loc_lat,
      :loc_long
    ])
    |> validate_required([:pincode, :hardware_id, :device_ip, :user_agent, :version, :timezone])
    |> normalize_pincode()
    |> unique_constraint(:pincode)
    |> unique_constraint(:hardware_id)
    |> put_expire()
  end

  defp normalize_pincode(%Ecto.Changeset{valid?: true} = changeset) do
    case get_change(changeset, :pincode) do
      nil -> changeset
      pincode -> put_change(changeset, :pincode, String.upcase(pincode))
    end
  end

  defp normalize_pincode(changeset), do: changeset

  defp put_expire(%Ecto.Changeset{valid?: true} = changeset) do
    {:ok, expires_at} = DateTime.from_unix(:os.system_time(:seconds) + 60 * 60, :second)
    change(changeset, %{expires_at: expires_at})
  end

  defp put_expire(changeset), do: changeset
end
