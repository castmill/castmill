defmodule Castmill.Addons.AddonBehaviour do
  @moduledoc """
  Behaviour for Castmill addons.

  Addons can be internal (bundled with Castmill) or external (loaded from
  separate packages). External addons can be configured via runtime.exs
  and provide their own routes, controllers, and UI components.

  ## Callbacks

  ### Required (none)

  All callbacks are optional to allow addons to implement only what they need.

  ### Optional

  - `mount_routes/2` - Define custom Phoenix routes
  - `register_hooks/0` - Register callbacks for system events (e.g., :user_signup)
  - `component_info/0` - Return UI component metadata for the dashboard
  - `search/3` - Implement search functionality
  - `router_module/0` - Return a Phoenix router module with the addon's routes
  - `api_routes/0` - Return API route definitions for dynamic mounting
  - `webhook_handlers/0` - Return webhook handler definitions

  ## External Addons

  External addons should be Elixir packages that define a module using
  `Castmill.Addons.Addon`. Configure them in runtime.exs:

      config :castmill, :external_addons, [
        {MyApp.BillingAddon, [stripe_key: "sk_..."]}
      ]

  The addon will be automatically started by the Addons Supervisor.
  """

  @callback mount_routes(router :: atom(), base_path :: String.t()) :: any()
  @callback register_hooks() :: any()

  @callback component_info() ::
              [component_info :: Castmill.Addons.ComponentInfo] | nil

  @callback search(
              organization_id :: String.t(),
              query :: String.t(),
              opts :: map()
            ) :: {:ok, list()} | {:error, String.t()}

  @doc """
  Returns a Phoenix router module that defines the addon's routes.

  The router will be forwarded to from the main CastmillWeb.Router.
  This is useful for external addons that want to define their own
  route structure with custom pipelines.

  ## Example

      def router_module do
        MyApp.BillingRouter
      end
  """
  @callback router_module() :: module() | nil

  @doc """
  Returns API route definitions to be mounted dynamically.

  Each route is a tuple of {method, path, controller, action}.
  Routes are mounted under /api/addons/:addon_id/

  ## Example

      def api_routes do
        [
          {:get, "/status", MyApp.BillingController, :status},
          {:post, "/checkout", MyApp.BillingController, :checkout}
        ]
      end
  """
  @callback api_routes() :: [{atom(), String.t(), module(), atom()}]

  @doc """
  Returns public (unauthenticated) API route definitions.

  Same format as api_routes/0 but these routes don't require authentication.
  Useful for endpoints like listing available plans that should be public.

  ## Example

      def public_api_routes do
        [
          {:get, "/plans", MyApp.BillingController, :list_plans}
        ]
      end
  """
  @callback public_api_routes() :: [{atom(), String.t(), module(), atom()}]

  @doc """
  Returns webhook handler definitions.

  Each handler is a map with:
  - `:path` - The webhook path (mounted under /webhooks/addons/:addon_id/)
  - `:handler` - The function to call {module, function}
  - `:verify` - Optional verification function {module, function}

  ## Example

      def webhook_handlers do
        [
          %{
            path: "/stripe",
            handler: {MyApp.Billing, :handle_stripe_webhook},
            verify: {MyApp.Billing, :verify_stripe_signature}
          }
        ]
      end
  """
  @callback webhook_handlers() :: [map()]

  @doc """
  Returns configuration required by the addon.

  Used to validate that all required configuration is present at startup.
  Returns a list of {key, description} tuples.

  ## Example

      def required_config do
        [
          {:stripe_secret_key, "Stripe API secret key"},
          {:stripe_webhook_secret, "Stripe webhook signing secret"}
        ]
      end
  """
  @callback required_config() :: [{atom(), String.t()}]

  @doc """
  Returns the path to the addon's static assets directory.

  External addons can use this to serve their own static files (JS, CSS, etc.)
  without copying them into the main castmill priv/static directory.

  The returned path should be an absolute path or a tuple like {:priv, :my_app, "static"}
  to resolve relative to the app's priv directory.

  ## Example

      def static_path do
        {:priv, :my_billing_addon, "static"}
      end

  The files will be served at /assets/addons/:addon_id/*
  For example: /assets/addons/billing/billing.js
  """
  @callback static_path() :: String.t() | {:priv, atom(), String.t()} | nil

  @optional_callbacks [
    mount_routes: 2,
    register_hooks: 0,
    component_info: 0,
    search: 3,
    router_module: 0,
    api_routes: 0,
    public_api_routes: 0,
    webhook_handlers: 0,
    required_config: 0,
    static_path: 0
  ]
end
