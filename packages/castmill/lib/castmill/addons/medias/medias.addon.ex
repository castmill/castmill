defmodule Castmill.Addons.Medias do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      id: "medias",
      name: "Medias",
      name_key: "sidebar.medias",
      description: "Medias view addon for Castmill",
      version: "0.1.0",
      path: "/medias.js",
      mount_path: "/content/medias",
      mount_point: "sidepanel.content.medias",
      icon: "/medias_icon.js",
      keyboard_shortcut: %{
        key: "M",
        description_key: "shortcuts.gotoMedias"
      }
    }
  end
end
