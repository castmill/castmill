defmodule Castmill.Addons.AddonBehaviour do
  @callback mount_routes(router :: atom(), base_path :: String.t()) :: any()
  @callback register_hooks() :: any()

  @callback component_info() ::
              {:ok, [component_info :: Castmill.Addons.ComponentInfo]} | :no_component

  @optional_callbacks [
    mount_routes: 2,
    register_hooks: 0,
    component_info: 0
  ]
end
