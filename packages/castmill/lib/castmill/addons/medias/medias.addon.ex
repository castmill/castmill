defmodule Castmill.Addons.Medias do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      name: "Medias",
      description: "Medias view addon for Castmill",
      version: "0.1.0",
      path: "/medias.js",
      mount_path: "/content/medias",
      mount_point: "sidepanel.content.medias",
      icon: "/medias_icon.js"
    }
  end
end
