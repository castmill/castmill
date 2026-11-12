---
sidebar_position: 4
title: MCP server
description: Connect AI agents to Castmill through the Model Context Protocol, with the tools and permissions they get.
---

# MCP server

Castmill includes a [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server. Any MCP client that supports remote servers, such as Claude, GitHub Copilot or Cursor, can use it to list and change content, build playlists, schedule channels, create automations and send commands to devices.

Setting up an agent in the dashboard is described in [AI agents](../dashboard/ai-agents.md). This page describes the protocol side.

## Connection

| | |
| --- | --- |
| Address | `POST https://api.example.com/mcp` |
| Transport | Streamable HTTP, stateless. Responses are JSON; there is no server-sent event stream. `GET` and `DELETE` return 405. |
| Protocol versions | `2025-06-18`, `2025-03-26` and `2024-11-05` |
| Authentication | `Authorization: Bearer cmagt_...`, the secret of an agent |

An example client configuration:

```json
{
  "mcpServers": {
    "castmill": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": { "Authorization": "Bearer cmagt_your_secret" }
    }
  }
}
```

The **Setup** tab of the **Agents** page shows ready-made configurations for common clients.

## Permissions

An agent is a member of one organization with a normal role. Every tool call is translated to a request to the same API that the dashboard uses and runs as the agent's user, so every permission, quota and validation rule applies. Give each agent the lowest role that lets it do its work; see [Users and teams](../concepts/users-and-teams.md) for what each role can do.

`tools/list` only returns the tools that the agent's role can use. A forbidden action returns an error, and is recorded in the activity log like every other call.

## Tools

| Area | Tools |
| --- | --- |
| Context | `get_context`: the agent's organization, role and permissions |
| Resources | `list_resources`, `get_resource`, `create_resource`, `update_resource`, `delete_resource` for medias, playlists, channels, devices, teams and layouts |
| Widgets | `list_widgets`, `get_widget` |
| Playlists | `add_playlist_item`, `update_playlist_item`, `update_playlist_item_config`, `move_playlist_item`, `remove_playlist_item` |
| Channels | `list_channel_entries`, `add_channel_entry`, `delete_channel_entry` |
| Devices | `list_device_channels`, `add_device_channel`, `remove_device_channel`, `send_device_command` |
| Automations | `list_automations`, `get_automation`, `create_automation`, `update_automation`, `assign_automation`, `delete_automation` |
| Other | `api_request`: calls any dashboard API path inside the agent's organization, for features without a dedicated tool |

The server also publishes a guide for agents as the resource `castmill://docs/agent-guide`. It explains the content model, common workflows and good practices, and good clients read it before they start.

## Limitations

- Agents cannot upload media files. They can list, rename and delete existing media and use them in playlists.
- Agents cannot manage agents, their secrets or the activity log.
- Agents only see their own organization.
- Tool results are limited to 100 KB. Use pagination (`page`, `page_size`) and `search` on lists.

## Security

- Only a SHA-256 hash of each secret is stored. The secret is shown once, when you create or rotate it.
- Agent secrets authenticate to both `/mcp` and the [Feeds API](./rest-api.md), where the agent's organization permissions apply. Agents cannot sign in to the dashboard, and dashboard sessions are rejected on `/mcp`.
- The activity log records the tool, arguments, result and duration of every call. Values that look like secrets, such as passwords, tokens and API keys, are replaced with `[REDACTED]`.
- Blocking the agent's organization, or revoking the secret, stops the agent immediately.
