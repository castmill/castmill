defmodule CastmillWeb.DeviceJSON do
  alias Castmill.Devices.Device
  alias Castmill.Devices.DevicesRegistrations
  @doc """
  Renders a list of medias.
  """
  def index(%{medias: medias}) do
    %{data: for(media <- medias, do: data(media))}
  end

  def index(%{playlists: playlists}) do
    %{data: for(playlist <- playlists, do: data(playlist))}
  end
  @doc """
  Renders a single user.
  """
  def show(%{device: device}) do
    %{data: data(device)}
  end

  defp data(%Device{} = device) do
    %{
      id: device.id,
      name: device.name,
      last_ip: device.last_ip,
      user_agent: device.user_agent,
      version: device.version,
      inserted_at: device.inserted_at,
      updated_at: device.updated_at,
      loc_lat: device.loc_lat,
      loc_long: device.loc_long
     }
  end

  defp data(%DevicesRegistrations{} = dr) do
    %{
      hardware_id: dr.hardware_id,
      pincode: dr.pincode,
    }
  end

end
