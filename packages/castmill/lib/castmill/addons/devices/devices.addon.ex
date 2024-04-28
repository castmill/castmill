defmodule Castmill.Addons.Devices do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      name: "Devices",
      description: "Devices management addon for Castmill",
      version: "0.1.0",
      path: "/devices.js",
      mount_path: "/devices",
      mount_point: "sidepanel.devices",
      icon: "/devices_icon.js"
    }
  end
end
