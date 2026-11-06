# Widget Option Choices from Integrations

> **Status: Implemented.** Server: `Castmill.Widgets.Schema` (`choices` validation),
> `Castmill.Widgets.Integrations.Fetcher` (optional `choices/3`),
> `Castmill.Widgets.Integrations.Choices`, `ChoicesStore` and
> `CastmillWeb.WidgetChoicesController`. Dashboard: `ChoicesField` in `ui-common` and
> `widget-config.tsx`. The organization-level office settings described under
> "Example: property listings" come with the property listing widget.
> Related: [TEMPLATE-VALUE-FORMATTING.md](./TEMPLATE-VALUE-FORMATTING.md),
> [INTEGRATION-ON-DEMAND-REFRESH.md](./INTEGRATION-ON-DEMAND-REFRESH.md).

## Problem

Widget options can point at Castmill resources (`ref` fields for medias, playlists and
layouts, with a visual picker) or take free input (text, numbers, colors, URLs,
locations). Widgets fed by an integration often need a value that only the
integration knows. Today users must type an ID:

| Widget | Value to pick | Known by |
|---|---|---|
| Property listing | The listing of the office, then its photos (in order) | castmill-broker (Vitec, Fasit, MSPECS, …) |
| Calendar widgets | Which calendar of the account | Google / Microsoft |
| Social widgets | Account, page or playlist | Instagram, Spotify, YouTube |
| Stock ticker | Symbols (search) | Finnhub |

Typing listing and photo IDs by hand is not acceptable UX. The photos must be chosen
by seeing them.

## Goals

- **Declarative:** a widget's `options_schema` says which field takes its choices from
  the integration and how to show them.
- **Generic:** any integration can provide choices; nothing is specific to listings or
  images.
- **Plain stored values:** a choice field stores a string or a list of strings, exactly
  what a typed value would be. The player, fetchers and saved configs are unaffected.
- **Visual:** thumbnails, search, multi-select with ordering, dependent fields.
- **Scalable:** search and paging for hundreds or thousands of choices.
- **Secure:** organization-scoped; credentials and integration config never leave the
  server.

## Non-goals

- Editing data in the source system.
- Choices for `data_schema`.
- Copying or proxying the source's media into Castmill. Thumbnails and previews load
  from the source's public URLs.

## Schema extension

A new optional attribute, `choices`, on `string` fields and on `list` fields whose
items are strings:

```json
"estate_id": {
  "type": "string", "required": true, "order": 1,
  "description": "Listing",
  "choices": { "list": "listings", "display": "cards", "search": true }
},
"selected_images": {
  "type": "list", "items": { "type": "string" }, "order": 2,
  "description": "Photos",
  "choices": {
    "list": "images", "depends_on": ["estate_id"], "display": "grid",
    "multiple": true, "ordered": true, "max": 30
  }
}
```

| Attribute | Required | Meaning |
|---|---|---|
| `list` | yes | Name of a choice list the widget's integration provides (`listings`, `images`, `calendars`, …). |
| `display` | no | `list` (default: label and description), `cards` (thumbnail, label, description) or `grid` (thumbnail tiles, for photos, videos, fonts and similar). |
| `search` | no | The provider supports text search; the picker shows a search box. |
| `multiple` | no | Several values; only on `list` fields. |
| `ordered` | no | With `multiple`: the user can reorder the selection, and the order is kept. |
| `min`, `max` | no | Selection bounds for `multiple`. |
| `depends_on` | no | Field keys whose current values the provider needs. The field is disabled until they are set. |

Rules enforced by `Castmill.Widgets.Schema`:

- `choices` is only allowed on `string` and list-of-`string` fields.
- `multiple` is only allowed on list fields, and `ordered` only together with
  `multiple`.
- Every key in `depends_on` must exist in the same schema, and dependencies must not
  form a cycle.
- `display` must be one of the values above.
- `choices` is only allowed on top-level fields of `options_schema` (not in nested
  `map` schemas, `data_schema` or transitions). List fields with choices must set
  `multiple`; `min` and `max` require `multiple`.

On install or upload, a widget that declares `choices` must have an integration whose
fetcher implements choices (see below); otherwise it is rejected.

## Provider contract (fetchers)

An optional callback on `Castmill.Widgets.Integrations.Fetcher`:

```elixir
@callback choices(list :: String.t(), params :: map(), credentials :: map()) ::
            {:ok, %{items: [choice()], next: String.t() | nil}} | {:error, term()}

@type choice :: %{
        required(:value) => String.t(),
        required(:label) => String.t(),
        optional(:description) => String.t(),
        optional(:thumbnail_url) => String.t(),
        optional(:preview) => %{
          required(:type) => String.t(),
          required(:url) => String.t(),
          optional(:mime_type) => String.t()
        },
        optional(:disabled) => boolean()
      }
```

The `params` passed to the callback:

| Key | Contents |
|---|---|
| `"options"` | The values of the field's `depends_on` fields from the form, `"display_locale"`, and the integration's `pull_config`, which wins over form values. |
| `"query"` | Search text, or `""`. |
| `"cursor"` | The `next` value from the previous page, or `nil`. |
| `"values"` | The field's currently selected values. The first page must include the choices for these values that still exist, so the form can show their thumbnails and labels. |

The `credentials` argument holds the resolved network and organization credentials and
settings (`Integrations.get_fetch_credentials/2`), as in the fetch path. Integrations
whose `auth_type` is not `optional` or `none` need credentials.

The server sanitizes the result: items without a `value` are dropped, the label
defaults to the value, unknown keys are removed, texts are capped, and thumbnail and
preview URLs must be `https` with a host (also `http` when
`config :castmill, Castmill.Widgets.Integrations.Choices, allow_http: true`, set in
development). At most 500 items per page are kept.

### Thumbnails and previews

A choice can stand for anything: a photo, a video, a sound, a font, or something with
no media at all (a calendar, an account). The picker therefore separates two things.

- **`thumbnail_url`** is the still image shown on a card or grid tile: the photo
  itself, a video's poster frame, an album's cover art. Providers should return a
  thumbnail size, e.g. the broker's `?w=320`. Without one, the picker shows a generic
  icon for the preview type, or just the label.
- **`preview`** is an optional, typed version the picker can play or render:

| `preview.type` | In the picker |
|---|---|
| `image` | A larger view of the image. |
| `video` | Plays muted on hover or focus, with a play button for touch and keyboard users. |
| `audio` | A play/stop button on the tile. |
| `font` | Loads the font and renders a sample text ("Aa Bb Cc 123") instead of a thumbnail. |
| unknown | Ignored: the thumbnail and label are shown. New types can be added without breaking older dashboards. |

The stored value is still only the choice's `value`; the preview type only affects how
the choice is presented, not what the widget does with it.

All URLs must be `https` (or `http` in development) and are loaded directly by the
browser. Fonts loaded from another domain need CORS headers from the source, and the
dashboard's Content Security Policy must allow the sources' images, media and fonts.

## Endpoint

```
POST /dashboard/organizations/:organization_id/widgets/:widget_id/choices/:field
{ "options": { "estate_id": "OBJ…" }, "query": "", "cursor": null, "values": ["MED…"] }
```

Response:

```json
{ "items": [{ "value": "MED…", "label": "Living room", "thumbnail_url": "https://…?w=320",
             "preview": { "type": "image", "url": "https://…?w=1920" } }], "next": null }
```

### Authorization and safety

- The user must be allowed to edit playlists in the organization, as for saving a
  widget config.
- The widget (by ID or slug) must be available to the organization
  (`Widgets.get_available_widget/2`, including network Widget Access policies);
  otherwise the endpoint answers `widget_not_found`.
- Only the field's `depends_on` values are taken from the request.
- **`pull_config` and organization integration settings always win over form values.** A user can never change
  integration-level settings such as a broker URL or account IDs. The fetch paths
  follow the same rule (see `Refresh.fetch_options/3` in
  [INTEGRATION-ON-DEMAND-REFRESH.md](./INTEGRATION-ON-DEMAND-REFRESH.md)): items may
  only override `pull_config` keys the widget declares in its `options_schema`.
- Credentials are resolved on the server as in the fetch path and are never returned.
- Calls are bounded by a timeout (10 s) and rate-limited per actor (60 requests per
  minute). A provider that raises, exits or times out yields `provider_error`.
- Successful responses are cached for 60 s per organization, keyed by integration,
  list and the provider params, to absorb repeated UI calls.
- Configuration: `config :castmill, Castmill.Widgets.Integrations.Choices, timeout:,
  cache_ttl:, rate_limit:, allow_http:`.

### Errors

| Status | Code | When |
|---|---|---|
| 403 | — | The actor cannot update playlists in the organization. |
| 404 | `widget_not_found` | No widget with that ID or slug is available to the organization. |
| 404 | `not_a_choice_field` | The field doesn't exist or has no `choices`. |
| 422 | `missing_dependency` | A `depends_on` value is empty. |
| 422 | `missing_credentials` | The integration needs credentials the organization doesn't have. |
| 429 | `rate_limited` | The actor exceeded the rate limit. |
| 502 | `provider_error` | No active choices provider, or the provider failed or timed out. |

The dashboard shows localized messages for these codes.

## Dashboard UX

The widget settings form (`widget-config.tsx`) renders a `ChoicesField` for fields
with `choices`, instead of a text input. The building blocks go in `ui-common` so
other screens can reuse them.

**Single value (`cards` / `list`).**
- The current choice is shown as a card (thumbnail, label, description) with a
  **Change** action.
- **Change** opens a dialog with search, incremental loading and keyboard navigation.

**Multiple, ordered (`grid`).**
- The selection is shown as a strip of thumbnails with position badges.
- Items can be reordered by dragging, or with move-left/move-right buttons so it
  works with the keyboard, and removed one by one.
- **Add** (e.g. "Add photos") opens a grid of all choices with checkboxes, a selection
  counter and select all/none. Newly added items are appended in the order they were
  clicked. Previews play or render as described in "Thumbnails and previews".
- If the selection is empty, the widget's own semantics apply (for property listings:
  show all photos). The empty state shows a widget-provided hint from the widget's
  `translations`.

**Dependent fields.**
- A dependent field is disabled, with a hint, until its dependencies are set.
- Changing a dependency asks for confirmation when it would clear the dependent
  selection (e.g. "Changing the listing clears the selected photos"). This applies
  when the dependency is itself a choice field; typing in a plain input doesn't clear
  dependents, whose stale values then show as "No longer available".

**Missing values.** A saved value that the provider no longer returns is shown as a
"No longer available" tile, with a remove action.

**States.** Loading skeletons, an error state with retry, and lazy-loaded thumbnails
and previews.

**i18n.** All UI text is in the nine dashboard languages (`widgets.choices.*`). Field
labels and hints come from the widget's `description` and `translations`; the empty
hint of a multiple field is the field's `placeholder` translation.

`ChoicesField` takes a `loadChoices(request)` function and localized labels, so it has
no dependency on the endpoint. Its README documents the props.

## Stored values

- A choice's `value` is a **stable identifier from the source** (a photo ID, a listing
  ID, a calendar ID), never a URL. A provider may use URLs as values only if the source
  has no identifiers at all.
- Fetchers resolve the stored identifiers to current URLs each time they fetch, keep
  the stored order, and skip identifiers that no longer exist.
- URLs therefore never end up in saved settings, where they would freeze host names,
  sizes, cache-busting parameters or expiring signatures. Settings also cannot point
  screens at arbitrary addresses: the server only resolves identifiers that belong
  to the source.

## Saved-value validation

Saved values are **not** checked against the provider on save. The source can be slow
or unavailable, and values can legitimately disappear later (a sold listing, a
removed photo). Templates and fetchers must tolerate unknown values. The property
listing fetcher already ignores photos that no longer exist and falls back to all
photos.

## Example: property listings

| List | Source | Choice |
|---|---|---|
| `listings` | Broker `GET /estates?agency=…&officeId=…`. The agency and office IDs are the **organization's integration settings** (see below), never form values. | value `estateId`, label street address, description area and status, thumbnail = main photo |
| `images` | Broker `GET /estates/:estate_id` | value `imageId`, thumbnail = photo URL with `?w=320`, preview `image` = `?w=1920` |

The `estate_id` and `selected_images` options keep exactly the values the migration
already writes, so migrated items open in the new picker without conversion.

**Office identity.** Property listing designs are shared by many offices (e.g. every Fastighetsbyrån office
uses the same template), so a widget cannot hold one office's IDs. Each organization stores its `agency`
and `office_ids` as **organization-level integration settings** (the per-organization integration
settings that already hold credentials). The network admin sets them, or the migration does, from the
legacy layers. Organization users cannot change them. The listing picker, the broker and area filter
choices, and the carousel fetcher all use them, so an organization only ever sees its own offices'
listings.

### Where data and files are stored

Castmill never stores the listing photos itself; it stores their IDs.

| Where | What is stored | Image files |
|---|---|---|
| Agency system (Vitec, Fasit, MSPECS, …) | The listing and the original photos (source of truth) | Originals |
| castmill-broker, MongoDB | Listing text and the list of photos (`imageId` and the photo's address in the agency system) | No |
| castmill-broker, object storage (**required companion change**, see below) | A durable copy of each delivered photo, per listing, photo ID and size | Yes, durable |
| CDN in front of the broker (`broker.images.castmill.io`) | Cached copies | Cached only |
| Castmill database: the playlist item's settings | Listing ID, chosen photo IDs in order, seconds per photo, override texts | No |
| Castmill database: stored integration data | Latest listing data, including the photo URLs on the CDN built from the IDs at each refresh | No |
| Castmill R2 / media library | Nothing for listings | No |
| Each screen | Photos downloaded from the CDN, kept in the player's media cache for offline playback | Yes, local cache |
| Dashboard (browser) | Thumbnails loaded directly from the CDN while picking | Browser cache only |

**Companion change in castmill-broker: durable photo storage.** Today the broker only
proxies photos from the agency systems, and CloudFront caches them. A CDN cache is not
storage: CloudFront drops objects that are rarely requested, and refetching fails when
the agency has removed the photo, the broker no longer has the listing, or the agency
system fails. In practice photos get lost.

The broker therefore keeps a copy:
- **Write-through:** the first time a photo is served, the broker stores the resized
  file in object storage, keyed by listing, photo ID and size. Later requests are
  served from that copy; the agency system is only contacted on a miss.
- **No visible change:** URLs and photo IDs stay the same, and CloudFront stays in
  front. Legacy players benefit too.
- **Retention:** a photo is deleted six months after its listing leaves the agency's
  feed.
- **Errors are never stored** (only successful image responses).

This is a separate change in castmill-broker, needed before property listing widgets
reach production.

## Alternatives considered

- **A dedicated `remote-image` field type.** Too specific: calendars, accounts and
  symbols need the same mechanism with other visuals.
- **Choosing from already-fetched widget data** (e.g. `data.all_images`). That only
  works after saving, can't choose the listing itself, and couples the editor to
  `data_schema`.
- **Calling the source from the browser.** It would expose credentials or require CORS
  on every source, and it isn't generic.

- **Copying chosen photos into Castmill's R2 storage.** That would only protect the new
  Castmill, copy the same photo once per organization, and require new core concepts
  (integration-owned media, quotas, syncing updated photos, cleanup). Durable storage
  in the broker solves the problem once, for every consumer.

## Open questions

1. Should choice lists also be usable when a network admin edits an organization's integration settings
   (for example, picking the offices from the broker instead of typing their IDs)?
2. Whether `values` lookups need their own call for very large lists.
