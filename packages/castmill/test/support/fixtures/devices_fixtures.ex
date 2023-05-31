defmodule Castmill.DevicesFixtures do

  import Castmill.Devices

  @moduledoc """
  This module defines test helpers for creating
  devices related entities.
  """

  @doc """
  Generate a device.
  """
  def device_fixture(attrs \\ %{}) do
    {:ok, device} =
      attrs
      |> Enum.into(%{
        name: "Hangar 42",
      })
      |> Castmill.Devices.create_device()
      device
  end

  @doc """
    Generate a devices registration.
  """
  def device_registration_fixture(attrs \\ %{}) do
    create_device_registration(Map.merge(attrs, %{
      version: "1.0.0",
      device_ip: "192.168.1.2",
      hardware_id: "some device id",
      timezone: "Europe/Amsterdam",
      loc_lat: "52.370216",
      loc_long: "4.895168",
      user_agent: "some user agent"
    }))
  end
end
