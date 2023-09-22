defmodule CastmillWeb.DeviceJSON do
  alias Castmill.Devices.Device
  alias Castmill.Devices.DevicesRegistrations
  alias Castmill.Resources.Calendar

  @doc """
  Renders a list of calendars
  """
  def index(%{calendars: calendars}) do
    %{data: for(calendar <- calendars, do: data(calendar))}
  end

  @doc """
  Renders a single device.
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
      pincode: dr.pincode
    }
  end

  defp data(%Calendar{} = calendar) do
    %{
      id: calendar.id,
      name: calendar.name
    }
  end
end
