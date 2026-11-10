# Integration Refresh on Demand

> **Status: Implemented.** `Castmill.Widgets.Integrations.Refresh`, `refresh_mode` on
> `widget_integrations`, `Castmill.Workers.IntegrationPoller.enqueue_refresh/1` and
> `remove_schedulers/1`. Tests: `test/castmill/widgets/integrations/refresh_test.exs`.

## Problem

Pull integrations keep their data fresh with a BullMQ **repeatable job** per
organization, integration and discriminator (scheduler ID
`int_poll_<org>_<integration>_<discriminator>`), every `pull_interval_seconds`.

**Jobs are scheduled when:**

- a widget config is created (credential-free integrations);
- the data is missing or due when a playlist is loaded (`Castmill.Resources`);
- the widget-config data endpoint or the dashboard prefetch is called;
- OAuth completes.

**Jobs are never removed when:**

- the playlist item, the playlist or the widget config is deleted;
- the content is in a playlist that no channel schedules;
- the screens that show it are offline or turned off.

The only removal is when an item's options change its discriminator. The removal for
missing credentials calls `cancel_polling` without a discriminator, so it removes
nothing.

So the number of upstream calls grows with every widget configuration ever created,
not with the screens actually showing them. For property listings (tens of thousands
of legacy layers; each call reaches the agency's system, e.g. Vitec) that is not
acceptable. The legacy player refreshed listings from the widget itself, about every
five minutes, and only while the widget was playing.

**Other facts relevant to the design:**

- Devices request their playlist (`GET /devices/:id/playlists/:pid`, which merges
  integration data into each widget config) every time their content queue runs low,
  so about once per playlist loop. A screen that is playing reads its data
  regularly; one that is offline or not scheduled never does.
- Concurrent fetches for the same data are not deduplicated (no lock or in-flight
  registry).
- `widget_config.last_request_at` and `widget_integration_data.last_used_at` are
  written but never read.
- The first-load fetch in `Castmill.Resources` calls the fetcher with the widget
  options only. The poller and controller merge in `pull_config`, so fetchers that
  rely on `pull_config` fail on that path.

## Proposal

A per-integration **refresh mode**:

| Mode | Behavior |
|---|---|
| `scheduled` (default, unchanged) | Repeatable polling every `pull_interval_seconds`. |
| `on_demand` | No repeatable jobs. Data is refreshed only when it is read and is older than `pull_interval_seconds`. |

The mode is stored in a new column, `widget_integrations.refresh_mode`, with a check
constraint and default `scheduled`. Widget packages declare it in their integration
definition.

### On-demand behavior

**On read.** Reads are the device playlist endpoint, the widget-config data endpoint,
the dashboard preview and prefetch, all through one function:

| Data state | Action |
|---|---|
| Missing | Fetch synchronously with a timeout (5 s), store, return. On timeout or error, return no data; the template shows its empty state. |
| Fresh (`now < refresh_at`) | Return it. |
| Stale | Return the stale data immediately and enqueue a **one-off** refresh job. |
| Very stale (older than 6 × the interval, e.g. after a screen was off overnight) | Try a synchronous refresh with a 3 s timeout; fall back to the stale data. |

**Deduplication.** The one-off job uses a deterministic job ID:
`int_refresh_<org>_<integration>_<discriminator>`, removed on completion. While one is
queued or running, more reads don't add jobs. Synchronous fetches take a PostgreSQL
advisory lock on the same key, so several devices loading the same playlist at once
cause a single upstream call. Requests that don't get the lock wait briefly for the
result, or return what is stored.

**On completion.** The job upserts the data (new version) and broadcasts
`widget_config_data_update` for dashboard previews. Devices pick it up on their next
playlist load. Pushing updates to devices is a possible later step.

**On errors.** The job keeps the last good data and stores the error. It sets
`refresh_at` with backoff: one interval, then 2×, 4×, … up to 30 minutes. A failing
source isn't hammered by every playing screen.

**Merging.** All fetch paths build the fetcher options the same way
(`Refresh.fetch_options/3`). An item may override only the `pull_config` keys that the widget
declares in its `options_schema` (e.g. a default `feed_url` the user can change). Undeclared
integration settings, such as a service URL, always win. This fixes the `Castmill.Resources` path
above, which ignored `pull_config`, and prevents items from redirecting server-side requests.

**Timeouts.** The synchronous waits (5 s for missing data, 3 s for very stale data) are configurable:
`config :castmill, Castmill.Widgets.Integrations.Refresh, missing_timeout: …, very_stale_timeout: …`.

**Lookups.** On-demand reads use only the data stored for exactly the item's options (its
discriminator), never the organization-level fallback used by scheduled integrations.

### Resulting load

- Upstream calls per discriminator are at most one per `pull_interval_seconds`, and
  only while some screen or preview is reading it.
- Offline screens, unscheduled playlists and deleted items cause no calls.
- With a 5-minute interval, a playing screen shows data at most about one interval
  plus one playlist loop old, which matches the legacy behavior.
- Time-relative content (upcoming viewings) stays correct between refreshes because
  the player filters it (see the formatting proposal).

Discriminators are scoped per organization. If two organizations show the same
listing, each refreshes its own copy. That keeps the existing isolation and is
acceptable.

### Switching an integration to `on_demand`

`Castmill.Workers.IntegrationPoller.remove_schedulers/1` removes its existing schedulers: it lists
the queue's job schedulers and removes those whose ID starts with `int_poll_<org>_<integration>_`.

## Related fixes for `scheduled` mode (recommended, separate change)

- A daily cleanup that removes schedulers whose discriminator no longer has any widget
  config referencing it.
- Fix the missing-credentials cancellation, which passes no discriminator.

## Which integrations use it

- **Property listings:** `on_demand`, 300 s interval, from the start.
- Weather, RSS and the stock ticker are candidates, but each needs its own evaluation
  (the stock ticker wants near-live data while it is shown, which `on_demand` with a
  short interval also provides).
- The default stays `scheduled`.

## Testing

- Unit tests for the read decision table above (missing, fresh, stale, very stale).
- Deduplication with concurrent reads (advisory lock plus a single queued job).
- Backoff after errors.
- Schedulers are never created in `on_demand` mode.
- The merge-precedence fix on every fetch path.

## Open questions

1. Is the 6 × "very stale" threshold right, and should devices ever wait for it?
2. Should devices get a push when on-demand data changes, instead of waiting for the
   next playlist load?
3. Should `last_used_at` be kept, e.g. to report unused content?
