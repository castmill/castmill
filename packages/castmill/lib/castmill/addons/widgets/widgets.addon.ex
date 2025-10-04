defmodule Castmill.Addons.Widgets do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      name: "Widgets",
      name_key: "sidebar.widgets",
      description: "Widgets management addon for Castmill",
      version: "0.1.0",
      path: "/widgets.js",
      mount_path: "/content/widgets",
      mount_point: "sidepanel.content.widgets",
      icon: "/widgets_icon.js"
    }
  end
end
