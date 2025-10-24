defmodule Castmill.Addons.Content do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def mount_routes(router, addons_base_path) do
    # Use Phoenix router DSL to define routes
    # Assuming `router` is the module name of your Phoenix router
    router.scope "#{addons_base_path}/content", as: :content do
      router.get("/", Castmill.Addons.ContentController, :index)
      router.get("/posts/:id", Castmill.Addons.ContentController, :show)
    end
  end

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      id: "content",
      name: "Content",
      name_key: "sidebar.content",
      description: "Content management addon for Castmill",
      version: "0.1.0",
      path: "/content.js",
      mount_path: "/content",
      mount_point: "sidepanel.content",
      icon: "/content_icon.js"
    }
  end
end
