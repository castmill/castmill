# Automations

Automations are reusable, organization-scoped rules of the form
**when** _an event happens_ **then** _do an action_. They are assigned to
devices and/or channels and evaluated **on the device**.

Phase 1 implements the **clock** event source and the **interrupt** action
(play a playlist, then continue normal programming with the next item). This
replaces legacy Castmill calendar "clock events".

Both sides are plugins. Adding a source or an action requires only:

1. a server module (behaviour `Castmill.Automations.Source` or
   `Castmill.Automations.Action`) registered in the app env;
2. a device implementation registered by type in `packages/device`;
3. a dashboard editor component registered for that type.

No migration of `automations`, no device engine change and no page change.
This is proven by stub test sources/actions in
`packages/castmill/test/castmill/automations/registry_test.exs` and
`packages/device/src/automations/engine.test.ts`.

## Data model

Migration: `priv/repo/migrations/20261106100000_create_automations.exs`

| Table                  | Columns                                                                   |
| ---------------------- | ------------------------------------------------------------------------- |
| `automations`          | `organization_id` (cascade), `name`, `enabled`, `rules` (jsonb list), timestamps |
| `automations_devices`  | `automation_id`, `device_id`, `position` (order on the device)            |
| `automations_channels` | `automation_id`, `channel_id`, `position` (order on the channel)          |
| `teams_automations`    | team access, like `teams_playlists`                                       |

A rule (stored inside `automations.rules`, order = rule order):

```json
{
  "id": "6f1c…",
  "when": { "source": "clock", "condition": "at", "config": { … } },
  "then": { "action": "interrupt", "config": { … } },
  "cooldown_seconds": 0
}
```

Rules are validated by the registered source and action modules (unknown
types, invalid configs, unsupported condition kind → changeset error on
`rules`). The server assigns a rule `id` when missing and fills action/source
config defaults. Max 50 rules per automation.

### Clock source (`source: "clock"`, condition `at`, kind `event`)

```json
{
  "schedule": { "type": "hourly", "minute": 8 }
            | { "type": "interval", "every_minutes": 15 }        // >= 5
            | { "type": "times", "times": ["08:00", "17:55"] }   // 1..48 entries
            | { "type": "once", "date": "2026-12-24", "time": "17:55" },
  "weekdays": [1, 2, 3, 4, 5],                      // ISO 1=Mon..7=Sun, null = every day, not allowed for once
  "window": { "start": "08:00", "end": "18:00" },  // optional, inclusive, start < end (no crossing midnight), not for once
  "dates": { "start": "2026-01-01", "end": null },  // optional inclusive local dates, not for once
  "timezone": "Europe/Stockholm"                    // optional; default = device (or channel) timezone
}
```

- `interval` is aligned to the start of the window (or 00:00 without window).
- Times are local wall-clock times. `Castmill.Automations.Sources.Clock.occurrences(config, timezone, from, to)`
  is a pure function returning sorted UTC `DateTime`s in `[from, to)`:
  - DST overlap (a local time exists twice): fires once, at the first instant.
  - DST gap (a local time does not exist): `hourly`/`interval` skip it;
    `times`/`once` fire at the first valid instant after the gap.
- Chrome 38 players cannot handle IANA zones, so the server expands each rule
  into UTC epoch-ms occurrences for the next **14 days** (tzdata).

### Interrupt action (`action: "interrupt"`, supports `event` and `state`)

```json
{
  "playlist_id": 12,
  "start": "immediately" | "after_current_item",
  "max_wait_seconds": 120,   // after_current_item only: max wait for the item boundary, then start anyway
  "plays": 1,                // 1..100; for state conditions content loops while active
  "priority": "normal" | "high"
}
```

`referenced_resources/1` returns `%{playlists: [12]}`. Deleting a referenced
playlist is blocked (`{:error, :playlist_has_automations}`, HTTP 409 with
`errors.automations`). After an interruption, normal programming continues
with the **next** item (the interrupted item is not resumed, no seek).

## Behaviours

```elixir
defmodule Castmill.Automations.Source do
  @callback type() :: String.t()
  @callback conditions() :: [%{name: String.t(), kind: :event | :state}]
  @callback validate_config(map()) :: {:ok, map()} | {:error, String.t()}
  @callback device_payload(config :: map(), context :: %{timezone: String.t(), from: DateTime.t(), to: DateTime.t()}) :: map()
  @callback required_capability() :: String.t()   # must be in device capabilities.automation_sources
  @callback upcoming(config, timezone, from, count) :: [DateTime.t()]   # optional: next `count` firings (previews / next firing)
end

defmodule Castmill.Automations.Action do
  @callback type() :: String.t()
  @callback validate_config(map()) :: {:ok, map()} | {:error, String.t()}
  @callback supports(:event | :state) :: boolean()
  @callback referenced_resources(map()) :: %{optional(atom()) => [term()]}
  @callback required_capability() :: String.t()   # must be in device capabilities.automation_actions
end
```

Registry: `Castmill.Automations.Registry` reads
`config :castmill, :automation_sources` / `:automation_actions` (module lists,
defaults `[Clock]` / `[Interrupt]`).

## Effective automations

A device's effective automations are, in order:

1. automations assigned to the device (by `automations_devices.position`;
   `PUT …/assignments` keeps existing positions and appends new ones);
2. automations assigned to each channel the device plays (channels in
   assignment order, then `automations_channels.position`), deduplicated.

Disabled automations are excluded. Rules whose source/action type is unknown
are skipped. Devices without automations get an empty payload and behave as
before.

## REST API

Dashboard (session auth, org-scoped, permission resource `automations`, same
role matrix as `channels`):

```
GET    /dashboard/organizations/:org/automations?search=&page=&page_size=   → {data: [Automation], count}
POST   /dashboard/organizations/:org/automations        {automation: {name, enabled, rules}} → 201 {data}
GET    /dashboard/organizations/:org/automations/registry                   → {data: {sources: [...], actions: [...]}}
POST   /dashboard/organizations/:org/automations/preview {when, timezone?, count?} → {data: {timezone, occurrences: [iso8601]}}
GET    /dashboard/organizations/:org/automations/:id                        → {data: Automation}
PATCH  /dashboard/organizations/:org/automations/:id    {automation: {name?, enabled?, rules?}} → {data}
DELETE /dashboard/organizations/:org/automations/:id                        → 204
PUT    /dashboard/organizations/:org/automations/:id/assignments {devices: [id], channels: [id]} → {data}
POST   /dashboard/organizations/:org/automations/:id/rules/:rule_id/run    → {data: {devices: n}}
GET    /dashboard/organizations/:org/channels/:channel_id/automations?from=&to= → {data: [Automation + occurrences]}
GET    /dashboard/devices/:device_id/automations                            → device payload (see below)
```

`Automation` JSON:

```json
{
  "id": 1, "name": "Spring offers", "enabled": true, "organization_id": "…",
  "rules": [Rule], "inserted_at": "…", "updated_at": "…",
  "devices": [{"id": "…", "name": "…", "online": true, "timezone": "…"}],
  "channels": [{"id": 3, "name": "…", "timezone": "…"}],
  "next_firing": "2026-11-06T15:08:00Z" | null,
  "warnings": [{"rule_id": "…", "device_id": "…", "device_name": "…", "missing": "automation_sources:clock"}]
}
```

`next_firing` uses the rule timezone, else the first assigned channel's, else
the first assigned device's, else UTC. `warnings` lists assigned devices
(directly or through channels) whose reported capabilities lack a rule's
required source/action.

Device (device token):

```
GET /devices/:device_id/automations
{
  "data": {
    "generated_at": 1762441200000, "valid_until": 1763650800000, "timezone": "Europe/Stockholm",
    "automations": [
      {"id": 1, "name": "…", "via": [{"type": "device"}, {"type": "channel", "id": 3, "name": "…"}],
       "rules": [
         {"id": "…", "index": 0, "source": "clock", "condition": "at", "kind": "event",
          "source_payload": {"occurrences": [1762441680000, …]},
          "action": "interrupt", "action_config": {…}, "cooldown_seconds": 0,
          "resources": {"playlists": [12]}}
       ]}
    ]
  }
}
```

Times are epoch milliseconds. The device may fetch referenced playlists
through `GET /devices/:device_id/playlists/:playlist_id` (allowed for
playlists referenced by its effective automations).

### Socket events (device channel `devices:<id>`)

- `automations_updated` `{}` → the device refetches the payload. Sent when an
  automation, an assignment, a referenced playlist or a device↔channel
  membership changes.
- `automation_run` `{automation_id, rule: <device rule>}` → "Run now": the
  device runs the rule's action once through the arbitration (ignores cooldown).

### Capabilities

Devices report `capabilities.automation_sources: ["clock"]` and
`capabilities.automation_actions: ["interrupt"]` in `POST /devices/:id/info`.

## Device engine (`packages/device/src/automations/`)

- `EventSource` (`start(config, emit)`, `stop()`), registered by type.
  `emit({type: 'fire'})` or `emit({type: 'active' | 'inactive'})`.
- `Action` (`run(config, context)`, `end()`), registered by type, with
  `usesPlayback` deciding whether it goes through arbitration.
- `AutomationEngine` turns emissions into firings and arbitrates playback:
  firings never interleave; `high` preempts a running `normal` one; otherwise
  automation order, then rule order; cooldowns; queued firings expire after
  `max_wait_seconds` (default 120 s); missed firings are not caught up.
- Clock source: schedules a timer for the next server-expanded occurrence.
  Occurrences older than 60 s are dropped. After `valid_until` (14 days
  offline) nothing fires.
- The payload is cached through the `ResourceManager` like channels (offline
  start) and refreshed on start, on `automations_updated` and daily.
- Interrupt: playlists are preloaded (JSON + media cached). The device stops
  the channel layer, plays the interrupt layer `plays` times, then resumes the
  channel playlist at the item after the interrupted one (playlist rotation,
  not seek). `after_current_item` waits for the next item boundary reported
  by the player (`PlayerGlobals.onItemStart`).
- Maintenance actions take precedence: the engine is stopped before reload.
- The debug overlay shows the next clock firing and the last firing result.
- Files: `types.ts` (interfaces), `registry.ts`, `engine.ts`,
  `sources/clock.ts`, `actions/interrupt.ts`, `device-playback-host.ts`
  (interrupt/resume on the device's single player) and `debug-overlay.ts`.
  `createDefaultRegistry()` registers the built-in types; platforms can pass
  their own `automationRegistry` to `new Device(...)`, and the registry's
  types are reported as capabilities.

### Adding a source or an action

1. Server: a module implementing `Castmill.Automations.Source` or
   `Castmill.Automations.Action`, listed in the `:automation_sources` /
   `:automation_actions` app env (defaults in `Castmill.Automations.Registry`).
2. Device: a class implementing `EventSource` or `Action`, registered with
   `registry.registerSource(type, factory)` / `registerAction(type, factory)`.
3. Dashboard: an editor component registered for the type.

## Quotas

`automations` (count per organization) and `automation_rules` (total rules
per organization). Defaults: 50 and 500 (migration + new network default plan).

## MCP

Tools `list_automations`, `get_automation`, `create_automation`,
`update_automation`, `assign_automation`, `delete_automation` map to the
dashboard routes above.

## Dashboard

- Page: `packages/dashboard/src/pages/automations-page/` at
  `/org/:orgId/automations` (sidebar entry under content).
- Type editors registered in `automations-page/registry.tsx`
  (`sourceEditors`, `actionEditors`, `sourceSummaries`, `actionSummaries`).
- Device page shows effective automations and upcoming firings; channel page
  shows assigned automations.
- Strings under `automations.*` in all nine locales.
