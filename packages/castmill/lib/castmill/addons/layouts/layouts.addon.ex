defmodule Castmill.Addons.Layouts do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      id: "layouts",
      name: "Layouts",
      name_key: "sidebar.layouts",
      description: "Layouts view addon for Castmill - manage reusable screen layouts",
      version: "0.1.0",
      path: "/layouts.js",
      mount_path: "/content/layouts",
      mount_point: "sidepanel.content.layouts",
      icon: "/layouts_icon.js",
      keyboard_shortcut: %{
        key: "L",
        description_key: "shortcuts.gotoLayouts"
      }
    }
  end
end
