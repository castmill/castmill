# Widget Scopes

Widgets are scoped so each organization only sees and uses the widgets meant for it.
This matters for multi-tenant deployments: for example, one real-estate agency must
never see another agency's templates.

## Scopes

| Scope        | Columns                                   | Available to                                 | Managed by                         |
| ------------ | ----------------------------------------- | -------------------------------------------- | ---------------------------------- |
| System       | `is_system = true`, no owner              | Every organization                           | Migrations, seeds, widget loader   |
| Network      | `network_id`                              | Organizations of that network                | Network admins (`/network/widgets`), SaaS addons |
| Organization | `organization_id`                         | That organization only                       | Its admins (dashboard upload)      |
| Unassigned   | `is_system = false`, no owner             | No organization                              | Root admin (assign a scope)        |

A system or network widget with `restricted = true` is only available to the
organizations listed in `widgets_organizations` (per-organization enablement). For
example, a network-wide real-estate widget enabled only for configured offices.

Database constraints keep the scope consistent: a widget has at most one owner,
system widgets have no owner, and organization widgets cannot be restricted.

## Rules

- `Castmill.Widgets.available_query/1` is the single definition of availability,
  including network curation of system widgets (see below). Use
  `list_available_widgets/2`, `get_available_widget/2`, `get_available_widget_by_slug/2`
  and `available?/3` in organization-facing code, never `list_widgets/1` or
  `get_widget/1`.
- Dashboard endpoints (`/dashboard/organizations/:id/widgets...`) require membership
  (`widgets` `:list`/`:show`) and return 404 for widgets that are not available.
- Organizations can only update (name/description) and delete widgets they own
  (`get_organization_widget/2`). Uploads always create organization widgets; scope
  fields in a `widget.json` are ignored.
- Playlist items can only use widgets available to the playlist's organization
  (`Resources.insert_item_into_playlist/6` checks with a share lock).
- Integration endpoints and OAuth start check that the integration's widget is
  available to the organization. Widget-scoped credentials must belong to an
  integration of the configured widget.
- Network-admin organization integration settings are derived from available widgets,
  including organization-owned widgets. Revoking access hides settings without deleting
  their saved values; stale saves for unavailable keys are rejected.
- The API adds `scope` and `can_manage` to widgets for the requesting organization
  (`Castmill.Widgets.put_access/2`); the dashboard shows the scope and only allows
  deleting widgets with `can_manage`.

## Changing scope (trusted callers)

Use `Castmill.Widgets.set_widget_scope/2`, `enable_widget_for_organization/2` and
`disable_widget_for_organization/2` (root admin, network tooling, SaaS addons).
They refuse (`{:error, {:in_use, organization_ids}}`) any change that would leave an
organization with playlist items using a widget it can no longer use, so playlists
never reference unavailable widgets. Enable the organizations first, then restrict.

## Network curation (network admins)

Root administrators can manage network admins in the Phoenix admin tool at
`/admin/networks/:id/admins`. Add an existing user by email; a user outside the
network is also added as a network member. Removing an admin demotes them to a
member without removing them from the network. The admin tool requires a root
admin passkey and uses a separate admin session. Root email/password credentials
can only bootstrap the first passkey, not bypass an enrolled key. See the backend
[admin passkey setup and recovery guide](../../packages/castmill/README.md#admin-passkeys).

Network admins curate the widget catalog of their network at `/network/widgets` in
the dashboard (`Castmill.Widgets.NetworkAccess`), for example to hide widgets for
services that are unavailable in their region or that need a subscription they don't
offer. Every system widget the platform offers to the network and every network-owned
widget has one access mode:

| Mode       | Meaning                                                                    |
| ---------- | -------------------------------------------------------------------------- |
| `all`      | Every eligible organization, including organizations created later        |
| `except`   | Every eligible organization except the listed ones; new ones are included |
| `selected` | Only the listed organizations; new ones are not included                  |
| `hidden`   | No organization of the network                                             |

The mode is stored per network, so a network never affects others:
`network_widget_policies` (network, widget, mode) and `network_widget_organizations`
(the listed organizations: excluded for `except`, included for `selected`). No policy
row means `all`. `available_query/1` applies the policy on top of the platform scope
for both system and network widgets.

Rules:

- Core widgets (`image`, `video`, `layout-widget`) are always available because
  playlists and media depend on them (`{:error, :core_widget}`).
- Platform-restricted system widgets (`restricted = true`) are only listed if the
  platform offers them to at least one organization of the network, and only those
  organizations are eligible.
- Network widgets restricted through `widgets_organizations` (for example by the scope
  backfill) are presented as `selected`/`hidden`; their first change opens that owner
  restriction and moves them to a network policy.
- Switching modes never changes who can use the widget: `all` → `except` starts without
  exclusions, `except`/`all` → `selected` lists the organizations that can currently
  use it. Turning an organization off for an `all` widget excludes it (`except`), so
  organizations created later still get it. Turning one on for a hidden widget selects it.
- Bulk changes (`%{search: text, enabled: boolean}`) apply to every eligible
  organization matching the search, not just the loaded page.
- Like other scope changes, curation refuses changes that would leave organizations
  with playlist items using a widget they can no longer use. The API answers 409 with
  the names of those organizations.

Dashboard API (network admins only, scoped to the caller's network):

| Method & path                                        | Purpose                                     |
| ---------------------------------------------------- | ------------------------------------------- |
| `GET /dashboard/network/widgets`                     | Paginated list with access summaries (`access`, `listed_count`, `enabled_count`), counts per mode; `search`, `kind`, `access` filters |
| `GET /dashboard/network/widgets/:id/organizations`   | Paginated eligible organizations with `enabled`/`in_use`; `search`, `status` filters |
| `PUT /dashboard/network/widgets/:id/access`          | Set the mode (`access`: `all`, `except`, `selected`, `hidden`) |
| `PATCH /dashboard/network/widgets/:id/organizations` | `enable`/`disable` ids, or `all_matching` with `enabled` and `search` |

The page is a master/detail view built for hundreds of widgets and organizations:

- Widget list: server-side search and filters, incremental loading, icons and access
  summaries.
- Access modes as four cards; hiding asks for confirmation.
- Organizations table (shared `Table`, `Pagination` and `SelectionActionBar`): search,
  status filter, per-row access switch, row selection for bulk changes, and
  "enable/disable all matching" with confirmation. In-use organizations are locked
  with an explanation.

Deleting an organization widget removes its playlist items through
`Resources.remove_item_from_playlist/2`, repairing the playlists' linked lists.

## Slugs and assets

Slugs stay globally unique; uploads check the slug before storing assets, so an upload
cannot overwrite another widget's assets. Slugs must match
`^[A-Za-z0-9][A-Za-z0-9_-]*$` (`AssetStorage.valid_slug?/1`) because they are used as
asset directory names.

## Migration of existing widgets

`AddWidgetScopes` (with `Castmill.Widgets.ScopeBackfill`) infers owners for existing
non-system widgets without widening access:

- used by one organization: organization widget,
- used by several organizations of one network: restricted network widget enabled
  for exactly those organizations,
- used across networks: restricted system widget enabled for those organizations,
- unused: unassigned.

`location-display-demo` and `intro` (shipped with the platform) become system widgets.
The widget loader (`WidgetsLoader`) always stores the widgets it loads as system
widgets.
