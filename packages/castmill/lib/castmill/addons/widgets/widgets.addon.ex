defmodule Castmill.Addons.Widgets do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      id: "widgets",
      name: "Widgets",
      name_key: "sidebar.widgets",
      description: "Widgets management addon for Castmill",
      version: "0.1.0",
      path: "/widgets.js",
      mount_path: "/content/widgets/*",
      mount_point: "sidepanel.content.widgets",
      icon: "/widgets_icon.js",
      keyboard_shortcut: %{
        key: "I",
        description_key: "shortcuts.gotoWidgets"
      }
    }
  end
end
