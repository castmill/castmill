defmodule CastmillWeb.DeviceJSON do
  alias Castmill.Devices.Device
  alias Castmill.Devices.DevicesRegistrations
  alias Castmill.Resources.Channel

  @doc """
  Renders a list of channels
  """
  def index(%{channels: channels}) do
    %{data: for(channel <- channels, do: data(channel))}
  end

  @doc """
  Renders a single device.
  """
  def show(%{device: device}) do
    %{data: data(device)}
  end

  @doc """
  Renders the recovery information for a device.
  """
  def recover(%{device: device}) do
    %{
      data: %{
        id: device.id,
        name: device.name,
        token: device.token
      }
    }
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
      loc_long: device.loc_long,
      rc_last_heartbeat: device.rc_last_heartbeat
    }
  end

  defp data(%DevicesRegistrations{} = dr) do
    %{
      hardware_id: dr.hardware_id,
      pincode: dr.pincode
    }
  end

  defp data(%Channel{} = channel) do
    %{
      id: channel.id,
      name: channel.name
    }
  end
end
