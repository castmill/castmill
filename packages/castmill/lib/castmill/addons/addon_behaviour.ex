defmodule Castmill.Addons.AddonBehaviour do
  @callback mount_routes(router :: atom(), base_path :: String.t()) :: any()
  @callback register_hooks() :: any()

  @callback component_info() ::
              [component_info :: Castmill.Addons.ComponentInfo] | nil

  @callback search(
              organization_id :: String.t(),
              query :: String.t(),
              opts :: map()
            ) :: {:ok, list()} | {:error, String.t()}

  @optional_callbacks [
    mount_routes: 2,
    register_hooks: 0,
    component_info: 0,
    search: 3
  ]
end
