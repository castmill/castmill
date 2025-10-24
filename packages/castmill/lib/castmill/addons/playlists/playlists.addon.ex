defmodule Castmill.Addons.Playlists do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      id: "playlists",
      name: "Playlists",
      name_key: "sidebar.playlists",
      description: "Playlists view addon for Castmill",
      version: "0.1.0",
      path: "/playlists.js",
      mount_path: "/content/playlists",
      mount_point: "sidepanel.content.playlists",
      icon: "/playlists_icon.js",
      keyboard_shortcut: %{
        key: "P",
        description_key: "shortcuts.gotoPlaylists"
      }
    }
  end
end
