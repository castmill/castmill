# AI Agents & MCP Server

AI agents (Claude, Copilot, Cursor, ...) control Castmill through a
[Model Context Protocol](https://modelcontextprotocol.io) server at `POST /mcp`.
Human documentation: `packages/website/docs/dashboard/ai-agents.md`.
Agent-facing guide (served as the MCP resource `castmill://docs/agent-guide`):
`packages/castmill/priv/mcp/agent-guide.md`.

## Design principles

1. **An agent is a user.** Every agent is backed by a `users` row with
   `is_agent: true` and an `organizations_users` membership with a regular role.
   No agent-specific permission system exists.
2. **One authorization path (DRY).** MCP tools do not call contexts directly.
   Each tool call is converted to an HTTP request to the existing
   `/dashboard/...` routes and dispatched in-process through
   `CastmillWeb.Endpoint` as the agent user. Every plug, `check_access/3`,
   `AuthorizeDash`, quota, team and validation rule therefore applies unchanged.
3. **Agent-only credentials.** Agents authenticate with a `cmagt_` secret that
   only `/mcp` accepts. Agent users have no password or passkey and cannot use
   dashboard sessions. Dashboard tokens are rejected on `/mcp`.

## Data model

Migration: `priv/repo/migrations/20261015080000_create_agents.exs`

| Table           | Purpose                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `users.is_agent` | Marks agent users. Excluded from members lists/counts, admin counts and `Accounts.delete_user` sole-admin checks.        |
| `agents`        | `name`, `description`, `user_id` (cascade), `organization_id` (cascade), `created_by_id`, `secret_hash` (SHA-256), `secret_prefix`, `last_used_at`, `last_ip` |
| `agent_actions` | Activity log: `tool`, `arguments` (size-capped JSON), `method`, `path`, `status`, `http_status`, `error`, `duration_ms`, `ip` |

The role lives in `organizations_users` like for any user. Deleting an agent
deletes its user (and thus its membership and log). Deleting an organization's
last human member deletes the organization and its agent users.

## Modules

| Module                                         | Responsibility                                                                         |
| ---------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Castmill.Agents`                              | Create/update/delete agents, rotate/revoke/authenticate secrets, log and list actions |
| `CastmillWeb.MCPController`                    | Auth via `Authorization` header (401 + `www-authenticate`), 403 for blocked user/org  |
| `CastmillWeb.MCP.Server`                       | JSON-RPC 2.0: `initialize`, `ping`, `tools/*`, `resources/*`, batches, notifications |
| `CastmillWeb.MCP.Tools`                        | Tool schemas, argument validation → `{method, path, opts}`, result shaping            |
| `CastmillWeb.MCP.Dispatcher`                   | Builds the in-process conn with a signed dashboard token, calls the Endpoint          |
| `CastmillWeb.AgentController`                  | Management API for the dashboard (admins manage; managers read)                       |

The transport is stateless Streamable HTTP. JSON responses only, no SSE.
`GET`/`DELETE /mcp` return 405. Protocol versions: 2025-06-18, 2025-03-26 and 2024-11-05.

## Routes

```
POST   /mcp                                                   # MCP endpoint
GET    /dashboard/organizations/:org/agents                   # admin, manager
POST   /dashboard/organizations/:org/agents                   # admin → {data, secret}
GET    /dashboard/organizations/:org/agents/:id               # admin, manager
PATCH  /dashboard/organizations/:org/agents/:id               # admin (name, description, role)
DELETE /dashboard/organizations/:org/agents/:id               # admin
POST   /dashboard/organizations/:org/agents/:id/credentials   # admin: rotate → {data, secret}
DELETE /dashboard/organizations/:org/agents/:id/credentials   # admin: revoke
GET    /dashboard/organizations/:org/agent-actions            # admin, manager (agent_id, status, page, page_size)
```

Agent users are always denied on the agent management API. The `api_request`
tool only resolves paths inside the agent's own organization (plus
`/devices/...` and `/widget-configs/...`, which have their own access checks).
It rejects `agents` / `agent-actions` segments, `..`, and query strings embedded
in the path.

## Security invariants

- Store only the SHA-256 hash of a secret; show the secret once on create or rotate.
- Never log secrets, `Authorization` headers or response bodies in
  `agent_actions`. Logged arguments are capped at 8 KB.
- Tool results are capped at 100 KB and truncated on a UTF-8 boundary.
- An agent's org membership defines all access. Do not add bypasses in tools.

## Adding a tool

1. Add the definition and a `build_request/3` clause in `CastmillWeb.MCP.Tools`.
   The clause must map to an existing dashboard route.
2. Document it in `priv/mcp/agent-guide.md`.
3. Add a test in `test/castmill_web/controllers/mcp_controller_test.exs`.

## Dashboard

`packages/dashboard/src/pages/agents-page/` has Agents, Activity and Setup tabs.
The service is `src/services/agents.service.ts`. The sidebar entry is shown to
admins and managers. All strings are under `agents.*` in all nine locales.

## Tests

- `packages/castmill/test/castmill/agents_test.exs`
- `packages/castmill/test/castmill_web/controllers/agent_controller_test.exs`
- `packages/castmill/test/castmill_web/controllers/mcp_controller_test.exs`
- `packages/dashboard/src/pages/agents-page/*.test.tsx`
- `packages/dashboard/src/services/agents.service.test.ts`
