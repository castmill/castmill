---
sidebar_position: 3
title: APIs and webhooks
description: The public interfaces of the Castmill server for pushing data, receiving webhooks, automating with AI agents and monitoring.
---

# APIs and webhooks

The Castmill server exposes a small set of stable interfaces for integrations. Use them instead of the dashboard's internal endpoints, which follow the dashboard's needs and may change between releases.

| Interface | Address | Use it to | Authentication |
| --- | --- | --- | --- |
| Feeds API | `/api/v1/feeds` | Push data that widgets show on screens | Feed token, or an organization member's or AI agent's token |
| MCP server | `/mcp` | Let AI agents manage content, schedules and devices | Agent secret |
| Widget webhooks | `/webhooks/widgets/...` | Push data to a widget with a push integration | None |
| Addon routes | `/api/addons/<id>/...`, `/webhooks/addons/<id>/...` | Endpoints added by [addons](./addons.md) | Defined by the addon |
| Health | `/api/health`, `/api/version` | Load balancer checks and monitoring | None |

All examples use these shell variables:

```bash
CASTMILL_URL=https://api.example.com
FEED_ID=...       # shown on the feed's page in the dashboard
FEED_TOKEN=...    # created on the feed's page, starts with cmfeed_
```

## Feeds API

A [feed](../dashboard/feeds.md) holds JSON data that widgets display, for example the latest sales figures, today's menu or the next departures. External systems such as scripts, Make or Zapier write to it; Castmill delivers the changes to every screen that shows the feed.

Send the token in the `Authorization` header as `Bearer <token>`:

- A **feed token** (`cmfeed_...`) is created on the feed's page and can read and write only that feed. Prefer it for integrations.
- The token of an **organization member** or an [AI agent](../dashboard/ai-agents.md) can write to every feed its role allows, and to several feeds in one request.

### Endpoints

| Method and path | Action |
| --- | --- |
| `POST /api/v1/feeds/:id/entries` | Add one entry (a JSON object), or several (a JSON array, or `{"entries": [...]}`). For list feeds. |
| `PUT /api/v1/feeds/:id/data` | Replace the whole document. For document feeds. |
| `DELETE /api/v1/feeds/:id/entries/:entry_id` | Delete one entry |
| `DELETE /api/v1/feeds/:id/entries` | Delete all entries |
| `GET /api/v1/feeds/:id` | Read the feed's settings and current data |
| `POST /api/v1/feeds/entries` | Add the same entry to several feeds: `{"feeds": [...], "entry": {...}}`. Member and agent tokens only. |

### Examples

Add an entry to a list feed:

```bash
curl -X POST "$CASTMILL_URL/api/v1/feeds/$FEED_ID/entries" \
  -H "Authorization: Bearer $FEED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Q3 target reached", "value": 1250000, "external_id": "kpi-q3"}'
```

Replace a document feed:

```bash
curl -X PUT "$CASTMILL_URL/api/v1/feeds/$FEED_ID/data" \
  -H "Authorization: Bearer $FEED_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"soup": "Tomato and basil", "main": "Mushroom risotto", "price": 12.5}'
```

### Limits

| Limit | Value |
| --- | --- |
| Entry size | 64 KB |
| Document size | 256 KB |
| Entries per request | 100 |
| Requests per token | 120 per minute |
| Requests per feed | 240 per minute |

Requests over a rate limit receive HTTP 429. The server logs which credential wrote to which feed, but never the token or the body.

[Feeds](../dashboard/feeds.md) describes list and document modes, deduplication with `external_id` and copying media into Castmill.

## MCP server

The [Model Context Protocol](https://modelcontextprotocol.io) server lets AI agents work with Castmill with the same permissions as a user. See [MCP server](./mcp.md).

## Widget webhooks

A widget whose [data integration](./widgets/data-integrations.md#push-webhooks) uses push mode receives data at `POST /webhooks/widgets/:integration_id/:widget_config_id`.

:::caution
Widget webhooks do not check signatures, so anyone who knows the address can post data to it. Use the Feeds API, which requires a token, for new integrations.
:::

## Health and version

```bash
curl "$CASTMILL_URL/api/health"
# {"status":"ok"}

curl "$CASTMILL_URL/api/version"
# {"status":"ok","build":{"castmill_git_sha":"...","built_at":"..."},"versions":{"castmill":"..."}}
```

Neither endpoint requires authentication or touches the database, which makes `/api/health` suitable for load balancer probes.

## Real-time connections

Players and the dashboard use Phoenix channels over WebSockets: players connect to `/socket` and the dashboard to `/user_socket`. These protocols are internal to Castmill's own clients. To react to changes from another system, use an [addon](./addons.md) hook instead.
