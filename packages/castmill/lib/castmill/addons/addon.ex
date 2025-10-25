defmodule Castmill.Addons.Addon do
  defmacro __using__(_opts) do
    quote do
      use GenServer

      @behaviour Castmill.Addons.AddonBehaviour

      # Default implementations for optional callbacks from your behaviour
      def mount_routes(_router, _base_path), do: :ok
      def register_hooks(), do: :ok
      def component_info(), do: nil
      def search(_organization_id, _query, _opts), do: {:ok, []}

      # Make init overridable in case consuming modules want their own implementation
      defoverridable mount_routes: 2
      defoverridable register_hooks: 0
      defoverridable component_info: 0
      defoverridable search: 3

      # Injected GenServer callbacks
      def start_link(opts) do
        GenServer.start_link(__MODULE__, opts, name: __MODULE__)
      end

      # Default init/1 callback for GenServer
      def init(init_arg) do
        # Here you can also call register_hooks if you want to ensure it's run as part of the GenServer initialization
        register_hooks()

        {:ok, init_arg}
      end
    end
  end
end
