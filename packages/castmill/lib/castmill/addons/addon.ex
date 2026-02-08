defmodule Castmill.Addons.Addon do
  @moduledoc """
  Use this module to create a Castmill addon.

  Addons are GenServers that can:
  - Register hooks for system events
  - Define custom routes and controllers
  - Provide UI components for the dashboard
  - Handle webhooks from external services

  ## Usage

      defmodule MyApp.BillingAddon do
        use Castmill.Addons.Addon

        @impl Castmill.Addons.AddonBehaviour
        def component_info do
          %Castmill.Addons.ComponentInfo{
            id: "billing",
            name: "Billing",
            ...
          }
        end

        @impl Castmill.Addons.AddonBehaviour
        def api_routes do
          [
            {:get, "/status", MyApp.BillingController, :status},
            {:post, "/checkout", MyApp.BillingController, :create_checkout}
          ]
        end
      end

  ## External Addons

  External addons (defined outside the Castmill OSS repository) can be
  loaded by configuring them in `runtime.exs`:

      config :castmill, :external_addons, [
        {MyApp.BillingAddon, [stripe_key: System.get_env("STRIPE_KEY")]}
      ]

  The options will be passed to `start_link/1` and available in `init/1`.
  """

  defmacro __using__(_opts) do
    quote do
      use GenServer

      @behaviour Castmill.Addons.AddonBehaviour

      # Default implementations for optional callbacks from your behaviour
      def mount_routes(_router, _base_path), do: :ok
      def register_hooks(), do: :ok
      def component_info(), do: nil
      def search(_organization_id, _query, _opts), do: {:ok, []}
      def router_module(), do: nil
      def api_routes(), do: []
      def public_api_routes(), do: []
      def webhook_handlers(), do: []
      def required_config(), do: []
      def static_path(), do: nil

      # Make all callbacks overridable
      defoverridable mount_routes: 2
      defoverridable register_hooks: 0
      defoverridable component_info: 0
      defoverridable search: 3
      defoverridable router_module: 0
      defoverridable api_routes: 0
      defoverridable public_api_routes: 0
      defoverridable webhook_handlers: 0
      defoverridable required_config: 0
      defoverridable static_path: 0

      # Injected GenServer callbacks
      def start_link(opts \\ []) do
        GenServer.start_link(__MODULE__, opts, name: __MODULE__)
      end

      # Default init/1 callback for GenServer
      def init(init_arg) do
        # Validate required config
        validate_required_config()

        # Register hooks as part of the GenServer initialization
        register_hooks()

        {:ok, init_arg}
      end

      # Make init overridable so addons can customize initialization
      defoverridable init: 1
      defoverridable start_link: 1

      # Helper to validate required configuration
      defp validate_required_config do
        required = required_config()

        Enum.each(required, fn {key, description} ->
          if is_nil(get_config(key)) do
            raise """
            Missing required configuration for addon #{__MODULE__}:
              #{key} - #{description}

            Add it to your config/runtime.exs or environment variables.
            """
          end
        end)
      end

      # Helper to get addon-specific configuration
      def get_config(key, default \\ nil) do
        Application.get_env(:castmill, __MODULE__, [])
        |> Keyword.get(key, default)
      end
    end
  end
end
