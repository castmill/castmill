# Addons

In Castmill, most of the functionality provided by the Dashboard is provided using addons. The addons facility in Castmill is quite flexible and it is crucial in order to provide the flexibility required for a powerful content management system.
In this section we are going to explain what addons are exactly and how to implement them.

## What are addons?

Addons are packages that are composed of a server part and a UI part. Some addons may only have a server part, for example the on-boarding addon that just sends an welcome email when a new user signs up do not require any UI.

The server part of the addon must reside in Erlangs BEAN machine. Castmill server will load all the addons when starting up, and they will run in their own processes, and supervised so that they are restarted if they should crash.

## How to implement an Addon?

Start by creating the entry point of the addon as a elixir file that implements the addon behaviour, for example, this would
be the starting poing for the "devices" addon in Castmill, that allows you to register, manipulate, etc your devices from the
dashboard:

```elixir
defmodule Castmill.Addons.Devices do
  use Castmill.Addons.Addon

  @impl Castmill.Addons.AddonBehaviour
  def component_info() do
    %Castmill.Addons.ComponentInfo{
      name: "Devices",
      description: "Devices management addon for Castmill",
      version: "0.1.0",
      path: "/devices.js",
      mount_path: "/devices",
      mount_point : "sidepanel.devices",
      icon: "/devices_icon.js"
    }
  end
end
```

In this case it is enough to just implement the "component_info" function of the AddonBehaviour. Let's break down the different fields and go through them. The name, description and version are self explanatory so we will leave without further explanation.
The path field is an important one, it specifies the SolidJS component that will be rendered in the dashboard. In this case,
we have `devices.js`, which is a javascript file that exports a default SolidJS component with the following signature:

```typescript
const DevicesPage: Component<{
  store: { organizations: { selectedId: string }; socket: Socket };
  params: any; //typeof useSearchParams;
}>;
```

Note: we will explain later on how the build system will build your SolidJS compontents and bundle them into a single file.

The next field is `mount_path`, describes the browser route that leads to the devices page in the dashboard. Next is the `mount_point`. This is the point in the dashboard UI where the addon will be mounted. For the devices view we want to make it accessible from the sidebar, so we specify the path to this point as a period separated key path `sidepanel.devices`. The addons system support any depth you want, but the parent path must exist before we can add children to it.

### Nested Client-Side Routing with Wildcards

If your addon needs **nested client-side routing** (sub-routes within the addon), you must append `/*` to your `mount_path`. This tells the SolidJS router to match all paths that start with your base path.

**Example - Simple addon (no nested routes):**

```elixir
mount_path: "/devices"  # Only matches /devices exactly
```

**Example - Addon with nested routes:**

```elixir
mount_path: "/content/widgets/*"  # Matches /content/widgets, /content/widgets/123, /content/widgets/123?tab=settings, etc.
```

**When to use wildcards:**

- Your addon has detail pages (e.g., `/widgets/:id`)
- Your addon uses tabs or sub-navigation via URL parameters
- Your addon implements its own internal routing

**How it works:**

1. The router matches all paths starting with your base path
2. The sidebar automatically strips `/*` from links (so users navigate to `/content/widgets`, not `/content/widgets/*`)
3. Your addon receives `routeParams` prop containing any wildcard segments (accessible via `routeParams['*']` or named params)

**Accessing route parameters in your component:**

```typescript
const MyAddon: Component<AddonComponentProps> = (props) => {
  // Access wildcard route segments
  const wildcardPath = props.routeParams['*']; // e.g., "123" for /widgets/123

  // Parse widget ID from the path
  const widgetId = wildcardPath?.split('/')[0];

  // Access query parameters
  const [searchParams] = props.params;
  const tab = searchParams.tab; // e.g., "integrations" for ?tab=integrations
};
```

## Loading addons

The addons are loaded by the server when it is started. The way to specify which addons to load is done in config.exs:

```elixir
# Configure the AddOns
config :castmill, :addons, [
  Castmill.Addons.Onboarding,
  Castmill.Addons.Content,
  Castmill.Addons.Playlists,
  Castmill.Addons.Devices
]
```
