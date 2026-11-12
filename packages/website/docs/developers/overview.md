---
sidebar_position: 1
title: Developer overview
description: The extension points of Castmill and where to start for widgets, integrations, addons, players and contributions.
---

# Developer overview

Castmill is open source and built to be extended. Choose your starting point by what you want to build.

<CardGrid columns={2}>
  <Card title="Widgets" href="/docs/developers/widgets/overview" icon="widget">
    Create new kinds of content as JSON templates: menus, dashboards, tickers or anything driven by data.
  </Card>
  <Card title="APIs and webhooks" href="/docs/developers/rest-api" icon="plug">
    Push data into feeds from other systems, receive webhooks and check server health.
  </Card>
  <Card title="MCP server" href="/docs/developers/mcp" icon="bot">
    Let AI agents manage content and screens through the Model Context Protocol.
  </Card>
  <Card title="Addons" href="/docs/developers/addons" icon="layers">
    Add pages to the dashboard and routes, hooks and webhooks to the server.
  </Card>
  <Card title="Player library" href="/docs/developers/player-library" icon="monitor">
    Embed the player in your own application or port it to a new device.
  </Card>
  <Card title="Contributing" href="/docs/developers/contributing" icon="code">
    Set up the repository, run the tests and send a pull request.
  </Card>
</CardGrid>

## Repository layout

Castmill is a Yarn workspace monorepo:

| Package | Language | Contents |
| --- | --- | --- |
| `packages/castmill` | Elixir, Phoenix | Server: API, WebSockets, admin tool, background jobs, built-in addons and widgets |
| `packages/dashboard` | TypeScript, SolidJS | Dashboard web application |
| `packages/ui-common` | TypeScript, SolidJS | Components shared by the dashboard and addons |
| `packages/player` | TypeScript | Rendering engine: playlists, layers, widgets and transitions |
| `packages/cache` | TypeScript | Offline cache for media and data used by players |
| `packages/device` | TypeScript, SolidJS | Device runtime: registration, scheduling, automations, maintenance, on-screen menu |
| `packages/widged` | JSON, TypeScript | Widget definitions and tooling |
| `packages/platforms/*` | Various | Players for browsers, Android, webOS and Electron, and the legacy adapter |
| `packages/website` | Docusaurus | This documentation |

## Choosing an approach

- To show **new data on screens**, start with a [feed](../dashboard/feeds.md) and an existing widget. If no widget fits, [write a widget](./widgets/overview.mdx) that reads the feed.
- To show **data from a third-party service** that has an API, write a widget with a [data integration](./widgets/data-integrations.md) so that the server fetches the data and caches it for all screens.
- To **automate** work that users do in the dashboard, use the [MCP server](./mcp.md) with an AI agent, or an addon for fixed workflows.
- To add a **new screen or section** to the dashboard, write an [addon](./addons.md).
- To support **new hardware**, implement the device's `Machine` interface; see [Player library](./player-library.md#porting-to-a-new-platform).

## License

The Castmill server, dashboard and players are licensed under the GNU Affero General Public License v3.0 or later. If you offer a modified Castmill as a network service, you must make your changes available to its users.
