---
sidebar_position: 5
title: Addons
description: Extend the Castmill server and dashboard with addons that add pages, API routes, webhooks, hooks and search results.
---

# Addons

An addon extends Castmill without changing its core. Most of the dashboard is built from addons: **Medias**, **Playlists**, **Layouts**, **Widgets** and **Devices** are addons that ship with Castmill. You can use the same mechanism for your own features, such as billing, a custom report or an integration with an internal system.

An addon has a server part written in Elixir and, optionally, a dashboard part written in SolidJS and TypeScript.

| An addon can | Through |
| --- | --- |
| Add a page to the dashboard sidebar | `component_info/0` and a SolidJS component |
| Add authenticated API routes | `api_routes/0`, mounted under `/api/addons/<id>/` |
| Add public API routes | `public_api_routes/0` |
| Receive webhooks | `webhook_handlers/0`, mounted under `/webhooks/addons/<id>/` |
| React to system events | `register_hooks/0` |
| Contribute results to global search | `search/3` |
| Serve its own static files | `static_path/0`, served under `/assets/addons/<id>/` |
| Check its configuration at start-up | `required_config/0` |

## The server part

An addon is a module that uses `Castmill.Addons.Addon`. That makes it a supervised GenServer: Castmill starts it with the server and restarts it if it crashes. Every callback is optional.

```elixir title="lib/castmill/addons/reports/reports.addon.ex"
defmodule Castmill.Addons.Reports do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info do
    %Castmill.Addons.ComponentInfo{
      id: "reports",
      name: "Reports",
      name_key: "sidebar.reports",
      description: "Proof-of-play reports",
      version: "1.0.0",
      path: "/reports.js",
      icon: "/reports_icon.js",
      mount_path: "/reports/*",
      mount_point: "sidepanel.reports",
      keyboard_shortcut: %{key: "R", description_key: "shortcuts.gotoReports"},
      translations_path: "/reports/i18n"
    }
  end

  @impl Castmill.Addons.AddonBehaviour
  def api_routes do
    [
      {:get, "/summary", Castmill.Addons.Reports.Controller, :summary}
    ]
  end

  @impl Castmill.Addons.AddonBehaviour
  def register_hooks do
    Castmill.Hooks.register_hook(:user_signup, &__MODULE__.on_user_signup/1)
  end

  def on_user_signup(%{user_id: _user_id, email: _email}), do: :ok
end
```

### Component info

| Field | Description |
| --- | --- |
| `id` | Unique identifier. Used in API, webhook and asset paths. |
| `name`, `name_key` | Sidebar label. `name_key` is a translation key; `name` is the fallback. |
| `description`, `version` | Informational. |
| `path` | Bundle of the page component, relative to the addon asset path. |
| `icon` | Bundle of the sidebar icon component. |
| `mount_path` | Dashboard route of the page, below `/org/:orgId`. Append `/*` if the addon has its own sub-routes, for example `/reports/*`. |
| `mount_point` | Position in the sidebar as a dotted path, such as `sidepanel.reports` or `sidepanel.content.reports`. The parent must exist. |
| `keyboard_shortcut` | Optional `Ctrl` + key shortcut that opens the page. |
| `translations_path` | Optional folder with `<locale>.json` files. The dashboard loads the user's language and falls back to `en.json`. |

### Hooks

`Castmill.Hooks.register_hook/2` subscribes a function to a system event. The `:user_signup` hook receives `%{user_id: ..., email: ...}` after a new account is created; the built-in onboarding addon uses it to send a welcome email.

### API routes and webhooks

Routes from `api_routes/0` are mounted under `/api/addons/<id>/` and require a signed-in dashboard user. Routes from `public_api_routes/0` do not require authentication, so check the input carefully. Each webhook handler is a map with a `:path`, a `:handler` function and an optional `:verify` function, which should check the provider's signature before the handler runs.

### Configuration

Addon options live in the application environment under the addon module. List the required keys in `required_config/0`, and the addon refuses to start with a clear message if one is missing:

```elixir
def required_config do
  [{:api_key, "API key of the reporting service"}]
end

# Read a value
get_config(:api_key)
```

## The dashboard part

The page component is a SolidJS component that receives `AddonComponentProps`:

```tsx title="lib/castmill/addons/reports/components/index.tsx"
import { Component } from 'solid-js';
import { AddonComponentProps } from '../../common/interfaces/addon-store';

const ReportsPage: Component<AddonComponentProps> = (props) => {
  const t = (key: string) => props.store.i18n?.t(key) ?? key;

  return (
    <div>
      <h1>{t('reports.title')}</h1>
      <p>Organization: {props.selectedOrgId}</p>
    </div>
  );
};

export default ReportsPage;
```

`props.store` gives the addon what it needs from the dashboard:

| Property | Contents |
| --- | --- |
| `organizations.selectedId` | The current organization |
| `env` | Server address and other environment values |
| `socket` | The dashboard's Phoenix socket, for live updates |
| `permissions` | The user's role and permission matrix, to hide actions the user cannot perform |
| `i18n` | `t`, `tp`, `formatDate`, `formatNumber`, `formatCurrency` and the current locale |
| `theme` | `light` or `dark` |
| `keyboardShortcuts` | Register page shortcuts such as **C** for create |
| `router` | `navigate` and `location` |

`props.params` holds the URL search parameters and a setter, and `props.routeParams` the route parameters.

Build the user interface with components from `@castmill/ui-common`, so the page looks like the rest of the dashboard, and take every colour from the `--cm-*` theme tokens so it works in light and dark mode. Use the translation function for every visible string.

### Building

Built-in addons are bundled by `packages/castmill/assets/build.js`. It builds `components/index.tsx` of every folder in `lib/castmill/addons` into `priv/static/assets/addons/<folder>.js`, and `components/icon.tsx` into `<folder>_icon.js`. Each bundle includes its own copy of `@castmill/ui-common` and injects its CSS when it loads.

## Installing an addon

Built-in addons are listed in `config/config.exs`:

```elixir
config :castmill, :addons, [
  Castmill.Addons.Onboarding,
  Castmill.Addons.Content,
  Castmill.Addons.Playlists,
  # ...
]
```

Addons that live in their own Mix project are added in `config/runtime.exs`, with options that are passed to `init/1`:

```elixir
config :castmill, :external_addons, [
  {MyCompany.ReportsAddon, [api_key: System.get_env("REPORTS_API_KEY")]}
]
```

An external addon serves its compiled JavaScript from its own `priv` folder through `static_path/0`, for example `{:priv, :my_company_reports, "static"}`.

## Testing

Run the dashboard tests of addons from `packages/castmill/assets`, after building `@castmill/ui-common`:

```bash
yarn workspace @castmill/ui-common build
cd packages/castmill/assets
npx vitest run ../lib/castmill/addons/reports/
```

Test the server part with ExUnit like any other module in `packages/castmill`.
