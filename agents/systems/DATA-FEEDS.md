# Data Feeds

> **Status: Implemented, except feed media and the legacy migration.**
> Server: `Castmill.Feeds` (feeds, entries, tokens, widget data), `CastmillWeb.FeedApiController`
> (`/api/v1/feeds`) and `CastmillWeb.FeedController` (dashboard API). Dashboard: `pages/feeds-page`.
> Copying media on receipt ("Media in entries") waits for the hardened HTTP client of PR #502;
> `media_fields` can already be configured. See "Implementation notes" at the end.

## Problem

Some widgets show data that an **external system pushes** to Castmill, rather than data Castmill fetches.
Legacy Castmill supported this, and it has been used reliably for years:

- **Länsförsäkringar's Facebook posts.** A Make (Zapier-like) scenario watches the Facebook page and, for
  each new post, calls the legacy endpoint `PUT /dev/medias/:ids/data?keep=N` with the post. The widget shows
  the latest posts. One call updates several widgets at once, and the post's image is copied to S3
  because Facebook's image URLs expire.
- Other systems can do the same: ticketing and queue systems, POS, internal dashboards, alarms.

The new Castmill has a push webhook, `POST /webhooks/widgets/:integration_id/:widget_config_id`. It can't
cover this use case:

- It targets **one playlist item**, so the same content in ten playlists needs ten calls, and the caller
  must know every item's ID.
- It **replaces** the data; it cannot append and keep the latest N entries.
- It stores external URLs as received, so expiring image links break.
- It is authenticated with a request signature, which is awkward in tools like Make.

There is no legacy-compatible endpoint. The modern API below must cover these use cases directly.

## Goals

- **Addressable content:** a reusable, organization-scoped resource that external systems write to and any
  number of widgets read from. One write updates every screen showing it.
- **Simple to call from Make, Zapier and scripts:** plain JSON over HTTPS with a bearer token.
- **Append with "keep the latest N"** as well as replace-all.
- **Works offline on players:** players cache the feed's data and media like other content.
- **Designed so automations (#506) can later use a feed as an event source,** e.g. "when the alarm feed
  receives an entry → interrupt".

## Non-goals

- Pulling data from external APIs: that's what pull integrations and fetchers do.
- Editing feed entries by hand in the dashboard, beyond viewing and deleting them.
- Rendering HTML from entries. Entries are data; templates format them.

## Concepts

### Feed (organization resource)

| Field | Meaning |
|---|---|
| `name`, `description` | Shown in the dashboard and in widget pickers |
| `mode` | `list`: entries are appended and the latest `keep` are kept, newest first. `document`: the whole data is replaced on each write. |
| `keep` | For `list`: how many entries to keep (1–100, default 10) |
| `schema` | Optional: the shape of an entry (same grammar as widget `data_schema`). Writes that don't match are rejected with a clear error. |
| `media_fields` | Optional: paths in an entry that hold media URLs, e.g. `image`, `attachments[].url`. See "Media in entries". |
| `tokens` | Write tokens for this feed (see "Authentication") |

Feeds follow the organization and permission model of other content (`feeds` permission: full access
for admin, manager, member, editor and publisher; read-only for device managers and guests), count
towards the `feeds` quota (default 20 per plan), and have their own dashboard page (`/org/:orgId/feeds`).
Team scoping is not implemented yet.

### Entry

What a writer sends: any JSON object (validated against `schema` if set), up to 64 KB. Castmill adds
`id`, `received_at` and, if the writer provides one, `external_id` (used for deduplication).

### Widgets reading a feed

A widget that shows feed data declares an option that picks a feed with the built-in `feeds` choice list
(see [WIDGET-OPTION-CHOICES.md](./WIDGET-OPTION-CHOICES.md)). No integration or fetcher is needed:

```json
"feed": { "type": "string", "required": true, "choices": { "list": "feeds", "search": true } }
```

Device playlists, dashboard previews and the widget data endpoint read the selected feed directly
(`Castmill.Feeds.widget_data/3`), checking that it belongs to the playlist's organization. A deleted
feed shows the widget's defaults with an integration error.

Templates receive:

| Data | Mode |
|---|---|
| `data.entries`: list of entries, newest first, each with its fields plus `id` and `received_at` | `list` |
| `data.document`: the current data | `document` |
| `data.updated_at` | both |

Templates format these with the formatting bindings (see [TEMPLATE-VALUE-FORMATTING.md](./TEMPLATE-VALUE-FORMATTING.md)).
For example, the latest 3 posts as a list:

```json
{ "list": { "key": "data.entries", "limit": 3 } }
```

The data is stored **once per feed**, and every widget configuration that uses the feed reads it.

## API

Base path: `/api/v1/feeds`. All requests and responses are JSON.

| Method and path | Purpose |
|---|---|
| `POST /api/v1/feeds/:id/entries` | Append one entry (`{...}`) or several (`{"entries": [...]}` or a JSON array, oldest first) to a `list` feed. Returns the stored entries (newest first, without those already dropped by `keep`) and the feed version. |
| `PUT /api/v1/feeds/:id/data` | Replace all data: a `document` feed's document (the body), or a `list` feed's entries (`{"entries": [...]}`). |
| `DELETE /api/v1/feeds/:id/entries/:entry_id` | Delete one entry. |
| `DELETE /api/v1/feeds/:id/entries` | Clear the feed. |
| `POST /api/v1/feeds/entries` | Append the same entry to several feeds: `{"feeds": [ids], "entry": {...}}`. This replaces the legacy multi-ID call. It needs a member token with access to every listed feed. |
| `GET /api/v1/feeds/:id` | Read the feed's current data (for debugging and for the writer's own checks). |

- **Deduplication:** if an entry has an `external_id` that already exists in the feed, it is **replaced
  in place**, not appended. Retries in Make and edited posts don't create duplicates.
- **Errors:**
  - 400 for invalid JSON or a schema mismatch (with the failing path);
  - 401/403 for authentication;
  - 404 for an unknown feed;
  - 413 when an entry is too large;
  - 429 when rate-limited.
- **Limits:** 64 KB per entry, 256 KB per document, 100 entries (or feeds) per call, `external_id` up
  to 255 characters. Rate limits: 120 requests per minute per credential and 240 per feed
  (`config :castmill, CastmillWeb.FeedApiController, token_limit_per_minute:, feed_limit_per_minute:`).
- **Reserved fields:** `id` and `received_at` in a written entry are ignored; Castmill sets them.

### Authentication

Writers send `Authorization: Bearer <token>`, using either:

1. **A feed token** (`cmfeed_…`): created in the feed's page, shown once, stored as a SHA-256 hash, and
   revocable (create a new one to rotate). It can only read and write that feed. This is the simplest option for one Make scenario per feed.
2. **A member token:** an organization member's access token or an AI agent token (`cmagt_…`, #498),
   with the `feeds` permission (`update` to write, `show` to read). Blocked users are rejected. It can write to every feed it has access to, and
   it's needed for the multi-feed call.

Tokens never appear in logs. Requests are logged with the feed ID, the token's identifier (not its
secret), the result and the size.

## Delivery to screens

- **On every write,** the feed's data version changes, and the change is broadcast to dashboard
  previews (`widget_config_data_update` with `feed_id`; `WidgetView` applies it only to previews showing
  that feed).
- **Devices** get the new data with their next playlist load, which happens once per loop. That is the
  same path and freshness as other integration data.
- **Later:** a device socket push for feeds can follow if faster updates are needed. With automations
  (#506), a feed can also become an event source.
- Feed integrations never poll and never schedule jobs: they only change when written to.

## Media in entries

Entries often reference images or videos by URL (a Facebook post's photo). Some of those URLs expire
within days (Facebook CDN links do), and a screen that hasn't cached the file by then would show nothing.
Feeds therefore **copy media on receipt** (as legacy did) and **own the copies**: every file belongs to its
feed, so a feed's media is tracked, listed, counted and cleaned up in one place.

### Feed media

A **feed media** record is created for each media URL found in an entry, at the paths declared in the
feed's `media_fields`:

| Field | Meaning |
|---|---|
| `feed_id` | The owning feed. Deleting the feed deletes its media. |
| `original_url` | The URL received in the entry. Logs and the dashboard only show its host. |
| `content_hash` | SHA-256 of the downloaded file |
| `storage_key`, `url` | Where the copy is stored in the organization's storage (R2), and its public URL |
| `content_type`, `size`, `width`, `height`, `duration` | Metadata read from the file |
| `status` | `pending`, `ready` or `failed` (with the reason) |
| `entries` | The entries that reference it |

- **Deduplication:** within a feed, the same original URL, or the same content, is stored **once** and
  shared by every entry that references it. A post that is re-sent or edited doesn't duplicate its photo.
- **Lifecycle:** a media is deleted when no entry references it any more: when the entry leaves the
  `keep` window, is deleted or replaced, or the feed is cleared or deleted. A daily job removes anything
  left over.
- **Quota:** feed media counts towards the organization's storage quota, and the dashboard shows it per
  feed. A write that would exceed the quota still stores the entry, but its media is marked `failed`
  (`quota_exceeded`).

### Copying

- **Asynchronous:** the entry is stored and acknowledged immediately, and its media is downloaded right
  after. The response lists each media with its status (`pending`).
- **Swap-in:** when a copy is `ready`, the entry's field is replaced by the stored URL, with the original
  kept in `<field>_original`. The feed's version changes, so screens pick it up.
- **Hardened downloads:** downloads use the hardened HTTP client from the RSS fetcher (PR #502):
  - SSRF checks on every request and redirect;
  - a size limit (e.g. 20 MB per file, configurable per network);
  - only image and video content types, checked against the file's actual bytes, not only the header.
- **Retries:** a failed download is retried a few times with backoff. If it still fails, the entry keeps
  the original URL and the media is shown as `failed` in the dashboard.
- **Per-field choice:** each path in `media_fields` is `copy` (default) or `link`, for sources whose URLs
  are permanent and shouldn't use quota.

### Alternatives considered

| Option | Why not |
|---|---|
| Link only | Expiring URLs break on screens that haven't cached them yet |
| Copy on first use (proxy) | Adds a proxy on the request path, and still fails when the URL expired before any screen asked for it |
| Media library items | Fills the organization's media library with feed content, and is heavy for frequent posts. Feed media stays separate and is managed with its feed. |

## Dashboard UX/UI

- **A "Feeds" page** (`/org/:orgId/feeds`): a list with name, mode, number of entries, last update, and the
  widgets that use it.
- **Feed page:**
  - settings (name, mode, keep, schema, media fields with copy or link);
  - **"Connect"** panel: the endpoint URLs, token management (create, copy once, revoke), and copyable
    examples (`curl`, and a step-by-step for Make's HTTP module);
  - **entries viewer:** the latest entries with their media status, delete per entry, clear all;
  - **"Media" tab:** every file the feed owns, with thumbnail, size, status (and failure reason), the
    entries using it, and the feed's total storage. A failed download can be retried;
  - **"Send test entry"** to check a widget before connecting the real source.
- **Widget settings:** the feed picker (choices), with a link to create a feed.
- All strings in the nine dashboard languages; org-scoped URLs.

## Migration from legacy

For legacy widgets fed through `PUT /dev/medias/:ids/data` (the Länsförsäkringar Facebook template):

- **Feeds:** one feed per legacy media, shared by every layer that used that media. The legacy `data`
  entries become its entries (the latest N). Their already-copied images become the feed's media, copied
  into the organization's storage.
- **Widgets:** the migrated widget items point to their feed.
- **Report:** the migration report lists, for each legacy media ID, the new feed ID and endpoint, so each
  Make scenario can be reconfigured. Tokens are created by the customer in the dashboard, never by the
  migration.

## Tests

- **Backend:**
  - append, replace, delete and multi-feed writes;
  - `keep` trimming;
  - `external_id` deduplication;
  - schema validation and limits;
  - authentication with both token types and permission checks;
  - rate limits;
  - feed media: copy, deduplication by URL and content, swap-in, retries and failure, cleanup when
    entries roll off or are replaced, the daily cleanup job, quota accounting and `quota_exceeded`;
  - delivery through the widget data path.
- **Dashboard:** components and i18n.
- **More than 90% coverage on new code.**

## Implementation notes

- **Storage:** `feeds`, `feed_entries` (unique `external_id` per feed; replaced entries keep their
  position and `received_at`) and `feed_tokens`. Writes lock the feed row, so concurrent writes are
  serialized and `version` increases by one per write.
- **Multi-feed writes** are atomic: if one feed rejects the entry (schema, not a list feed), nothing is
  written and the error names the feed.
- **Dashboard API** (`/dashboard/organizations/:org/feeds`): CRUD with entry and usage counts, `entries`,
  `test-entry`, entry deletion, `clear`, and tokens (`POST` returns the secret once; `DELETE` revokes).
- **Usage** ("used by") counts playlist items whose options hold the feed's id as a top-level value.
- **Pending:** feed media (copy on receipt, `feed_media` records, quota, cleanup) after PR #502 merges;
  the legacy migration; team scoping; MCP tools for feeds (agents can already use the REST API).

## Open questions

1. Should feeds be shareable across organizations in a network (e.g. one Facebook feed for all offices of
   a chain)? Proposed: not now; the multi-feed call covers that case.
2. Per-entry expiry (e.g. an `expires_at` field that hides an entry automatically)?
