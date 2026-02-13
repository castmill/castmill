# External Addons System

This document describes how external addons (commercial or third-party) integrate with Castmill without modifying the OSS codebase.

## Overview

Castmill's addon system supports both **internal addons** (bundled with OSS) and **external addons** (loaded from separate packages). External addons can:

- Define API routes (authenticated and public)
- Provide UI components for the dashboard
- Handle webhooks
- Serve their own static assets

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Host Application                          │
│  (e.g., CastmillSaas)                                       │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Application.start:                                      │ │
│  │   Application.put_env(:castmill, :external_addons, [   │ │
│  │     {MyAddon, [config: "value"]}                        │ │
│  │   ])                                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Castmill (OSS)                            │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Addons.Supervisor:                                      │ │
│  │   - Starts internal addons                              │ │
│  │   - Starts external addons from config                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Router:                                                 │ │
│  │   /api/addons/:addon_id/* → Addon API routes           │ │
│  │   /webhooks/addons/:addon_id/* → Webhook handlers      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ AddonStatic Plug:                                       │ │
│  │   /assets/addons/:addon_id/* → Addon static files      │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Creating an External Addon

### 1. Define the Addon Module

```elixir
defmodule MyAddon do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def init(opts) do
    # Initialize addon (called at GenServer start)
    Logger.info("MyAddon starting with opts: #{inspect(opts)}")
    {:ok, opts}
  end

  @impl Castmill.Addons.AddonBehaviour
  def component_info do
    %Castmill.Addons.ComponentInfo{
      id: "myaddon",                        # Unique ID, used in URLs
      name: "My Addon",                      # Display name
      name_key: "sidebar.myaddon",           # i18n key for localized name
      path: "/myaddon/myaddon.js",           # Path to main JS component
      mount_path: "/myaddon",                # Dashboard route
      mount_point: "sidepanel.bottom.myaddon",
      icon: "/myaddon/icon.js",              # Path to icon component
      translations_path: "/myaddon/i18n"     # Path to translations folder
    }
  end

  @impl Castmill.Addons.AddonBehaviour
  def static_path do
    # Returns path to addon's static files
    {:priv, :my_addon, "static"}
  end

  @impl Castmill.Addons.AddonBehaviour
  def api_routes do
    # Routes that require authentication
    [
      {:get, "/status", MyAddon.Controller, :status},
      {:post, "/action", MyAddon.Controller, :do_action}
    ]
  end

  @impl Castmill.Addons.AddonBehaviour
  def public_api_routes do
    # Routes without authentication
    [
      {:get, "/info", MyAddon.Controller, :public_info}
    ]
  end

  @impl Castmill.Addons.AddonBehaviour
  def webhook_handlers do
    [
      %{
        path: "/external-service",
        handler: {MyAddon.Webhooks, :handle},
        verify: {MyAddon.Webhooks, :verify_signature}
      }
    ]
  end
end
```

### 2. Directory Structure

```
my_addon/
├── mix.exs
├── lib/
│   ├── my_addon.ex              # Core business logic
│   └── my_addon/
│       ├── addon.ex             # Addon module (use Castmill.Addons.Addon)
│       ├── controller.ex        # API controller
│       └── webhooks.ex          # Webhook handlers
└── priv/
    └── static/                  # Static assets (served by AddonStatic)
        ├── myaddon.js           # Main UI component
        ├── icon.js              # Sidebar icon
        └── i18n/                # Translations
            ├── en.json
            ├── es.json
            └── ...
```

### 3. Register the Addon

In your host application's `Application.start/2`:

```elixir
def start(_type, _args) do
  Application.put_env(:castmill, :external_addons, [
    {MyAddon, [some_config: "value"]}
  ])
  
  # Start your supervision tree...
end
```

## Addon Behaviour Callbacks

### Required Callbacks

None - all callbacks are optional.

### Optional Callbacks

| Callback | Returns | Description |
|----------|---------|-------------|
| `init/1` | `{:ok, state}` | GenServer initialization |
| `component_info/0` | `%ComponentInfo{}` | UI component metadata |
| `static_path/0` | `{:priv, app, path}` | Path to static assets |
| `api_routes/0` | `[{method, path, controller, action}]` | Authenticated routes |
| `public_api_routes/0` | `[{method, path, controller, action}]` | Public routes |
| `webhook_handlers/0` | `[%{path, handler, verify}]` | Webhook definitions |
| `required_config/0` | `[{key, description}]` | Required config validation |
| `register_hooks/0` | `:ok` | Register system event hooks |
| `search/3` | `{:ok, results}` | Search functionality |

## Static Asset Serving

### How It Works

The `CastmillWeb.Plugs.AddonStatic` plug intercepts requests to `/assets/addons/:addon_id/*`:

1. Looks up the addon by ID from `component_info().id`
2. Calls `static_path/0` to get the addon's static directory
3. Serves the requested file with appropriate content-type
4. Validates the path stays within the static directory (security)

### URL Mapping

```
Request: GET /assets/addons/billing/billing.js
         └────┬─────┘ └──┬──┘ └────┬────┘
              │         │         │
              │         │         └── File path within static dir
              │         └── Addon ID (from component_info)
              └── Fixed prefix

Resolution:
1. Find addon with id="billing"
2. Call billing.static_path() → {:priv, :castmill_billing, "static"}
3. Resolve to: /path/to/castmill_billing/priv/static/billing.js
4. Serve file
```

### Security

- Paths are validated to prevent directory traversal
- Only files within the addon's static directory are served
- Non-existent files pass through to the next plug (404 from router)

## Dashboard Integration

### Component Loading

The dashboard loads addon UI components via dynamic import:

```typescript
// protected-route.tsx
const addOnBasePath = `${baseUrl}/assets/addons`;

// Load main component
const module = await import(`${addOnBasePath}${addon.path}`);

// Load icon
const iconModule = await import(`${addOnBasePath}${addon.icon}`);

// Load translations
const translationsUrl = `${addOnBasePath}${addon.translations_path}/${locale}.json`;
const translations = await fetch(translationsUrl).then(r => r.json());
```

### Mount Points

Addons specify where they appear in the UI via `mount_point`:

- `sidepanel.top.*` - Top section of sidebar
- `sidepanel.bottom.*` - Bottom section of sidebar
- `toolbar.*` - Toolbar actions
- `settings.*` - Settings pages

## API Routes

### Authenticated Routes

Mounted at `/api/addons/:addon_id/*`, require JWT authentication:

```
GET  /api/addons/billing/status   → BillingController.status
POST /api/addons/billing/checkout → BillingController.create_checkout
```

### Public Routes

Mounted at `/api/addons/:addon_id/*` but without authentication pipeline:

```
GET /api/addons/billing/plans → BillingController.list_plans (no auth)
```

## Webhooks

External services can POST to `/webhooks/addons/:addon_id/:path`:

```
POST /webhooks/addons/billing/stripe
     └───────────────┬──────────────┘
                     │
     Routed to: BillingWebhookHandler.handle_stripe/2
     Verified by: BillingWebhookHandler.verify_stripe/2
```

## Best Practices

### DO:

- Keep static assets in addon's `priv/static/`
- Use `static_path/0` callback for proper resolution
- Support all 9 Castmill languages in translations
- Validate required config in `init/1`
- Use `public_api_routes/0` for endpoints that don't need auth

### DON'T:

- Copy addon assets to Castmill OSS directories
- Hardcode paths to other packages
- Skip webhook signature verification
- Forget to handle missing translations gracefully

## Related Documentation

- [AGENTS.md](/AGENTS.md) - Main project documentation
- [Addon Behaviour](/packages/castmill/lib/castmill/addons/addon_behaviour.ex) - Callback definitions
- [AddonStatic Plug](/packages/castmill/lib/castmill_web/plugs/addon_static.ex) - Static file serving
