# Castmill agent guide

You are connected to **Castmill**, a digital signage platform, through its MCP
server. You act as an *agent member* of exactly one organization. Everything
you do goes through the same API and the same permission checks as a human
member with your role, and every tool call is recorded in the organization's
agent activity log.

Start every session by calling `get_context`. It returns your agent name, your
organization id, your role and the actions your role allows per resource type.

## Domain model

| Concept            | Description                                                                                                                             |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Media** (`medias`) | Images, videos and audio files uploaded by users. Agents cannot upload files, but can list, inspect, rename and delete medias.       |
| **Widget**         | A content template (image, video, text, web page, weather, RSS, layout, ...). Use `list_widgets` / `get_widget` to see options schemas. |
| **Playlist** (`playlists`) | An ordered list of *items*. Each item is a widget instance with a duration (ms) and widget options.                            |
| **Layout** (`layouts`) | A screen split into zones; layout widgets reference playlists per zone.                                                             |
| **Channel** (`channels`) | A schedule: a default playlist plus time-based *entries* (playlist + start/end, optionally repeating weekly). Has a timezone.     |
| **Device** (`devices`) | A physical screen/player. Devices play the channels assigned to them.                                                              |
| **Team** (`teams`) | A group of members with access to a subset of resources.                                                                                |
| **Tag**            | Labels (optionally grouped) used to organize resources.                                                                                 |

Content flows **media → playlist items → playlists → channels → devices**.

## Roles

Your role is chosen by the organization admins: `admin`, `manager`, `member`,
`editor`, `publisher`, `device_manager` or `guest`. When an action is not
allowed the tool returns an error result with HTTP status 403. Do not retry; ask
the human to change your role if the action is required.

## Tools

| Tool                          | Purpose                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------- |
| `get_context`                 | Your identity, organization and permissions. Call first.                                      |
| `list_resources`              | Paginated list of medias, playlists, channels, devices, teams or layouts (supports `search`). |
| `get_resource`                | Fetch one media, playlist (with items), channel or layout.                                    |
| `create_resource`             | Create a playlist, channel, team or layout.                                                   |
| `update_resource`             | Update a media, playlist, channel, device or layout.                                          |
| `delete_resource`             | Delete a media, playlist, channel, device, team or layout.                                    |
| `list_widgets` / `get_widget` | Discover widgets and their `options_schema` / `data_schema`.                                  |
| `add_playlist_item`           | Append or insert a widget item in a playlist.                                                 |
| `update_playlist_item`        | Change item attributes such as `duration` or `name`.                                          |
| `update_playlist_item_config` | Change the widget options/data of an item.                                                    |
| `move_playlist_item`          | Reorder an item (`target_id` = item it should follow, `null` = first).                        |
| `remove_playlist_item`        | Remove an item from a playlist.                                                               |
| `list_channel_entries`        | Scheduled entries of a channel.                                                               |
| `add_channel_entry`           | Schedule a playlist in a channel (`start`/`end` in milliseconds since epoch).                 |
| `delete_channel_entry`        | Remove a scheduled entry.                                                                     |
| `list_device_channels`        | Channels assigned to a device.                                                                |
| `add_device_channel`          | Assign a channel to a device.                                                                 |
| `remove_device_channel`       | Unassign a channel from a device.                                                             |
| `send_device_command`         | `refresh`, `restart_app`, `restart_device`, `clear_cache`, `update_app`, `update_firmware`.   |
| `api_request`                 | Generic access to the rest of the dashboard API (see below).                                  |

Tool results contain the JSON returned by the API. Failed calls are returned
with `isError: true` and the HTTP status, for example `HTTP 422 (validation
failed)` with the validation errors.

## Common workflows

### Create a playlist with an image

1. `list_resources` with `resource_type: "medias"` and `search` to find the media id.
2. `list_widgets` and pick the widget named `Image` (note its `id`).
3. `create_resource` with `resource_type: "playlists"` and `attributes: {"name": "Lobby"}`.
4. `add_playlist_item` with the playlist id, widget id, `duration: 10000` and
   `options: {"image": <media id>}` (check the widget `options_schema` for exact keys).

### Show a playlist on a screen

1. `create_resource` `channels` with `{"name": "Lobby", "timezone": "Europe/Stockholm", "default_playlist_id": <playlist id>}`.
2. `list_resources` `devices` to find the device.
3. `add_device_channel` with the device id and channel id.

### Schedule content

Use `add_channel_entry` with `start`/`end` timestamps in milliseconds. Pass
`repeat_weekly_until` (milliseconds) to repeat the entry every week.

## `api_request`

`api_request` calls any dashboard endpoint not covered by a dedicated tool.
Paths are **relative to your organization**: `/tags` is sent to
`/dashboard/organizations/<your org>/tags`. Paths starting with `/devices/` and
`/widget-configs/` are global endpoints, still access-checked. Pass query
parameters with `query` and the JSON body with `body`; path segments may only
contain letters, digits, `-` and `_`.

Useful endpoints:

| Method & path                                              | Description                                    |
| ---------------------------------------------------------- | ---------------------------------------------- |
| `GET /tags`, `POST /tags`, `PUT /tags/:id`, `DELETE /tags/:id` | Tags (`{"name", "color", "tag_group_id"}`)   |
| `GET /tag-groups`, `POST /tag-groups`                      | Tag groups                                     |
| `GET /:type/:id/tags`, `PUT /:type/:id/tags`               | Tags of a resource (`{"tag_ids": [...]}`)      |
| `POST /tags/:tag_id/bulk`                                  | Tag many resources                             |
| `GET /teams/:team_id/members`                              | Team members                                   |
| `GET /teams/:team_id/:resource_type`                       | Resources shared with a team                   |
| `PUT /teams/:team_id/:resource_type/:resource_id`          | Share a resource with a team                   |
| `GET /usage`                                               | Resource usage vs. quotas                      |
| `GET /quotas`                                              | Organization quotas                            |
| `GET /search`                                              | Global search (`query: {"query": "..."}`)      |
| `GET /members`, `GET /invitations`, `POST /invitations`    | Organization members and invitations           |
| `GET /playlists/:id/ancestors`                             | Layouts that embed a playlist                  |
| `PATCH /channels/:channel_id/entries/:id`                  | Update a scheduled entry                       |
| `GET /devices/:id/events`                                  | Device event log                               |
| `GET /devices/:id/telemetry`                               | Device telemetry                               |
| `GET /devices/:id/cache`                                   | Device cache content                           |
| `GET /devices/:id/timers`, `POST /devices/:id/timers`      | On/off timers                                  |
| `GET /devices/:id/schedule`, `PUT /devices/:id/schedule`   | Device power schedule                          |

## Limitations

- Agents cannot upload media files (multipart uploads are not supported by MCP).
- Agents cannot manage agents, credentials or the agent activity log.
- Agents can only access their own organization.
- Large responses are truncated; use pagination (`page`, `page_size`) and `search`.

## Good practices

- Read before writing: fetch the resource and confirm ids before modifying it.
- Prefer the dedicated tools over `api_request`.
- Destructive actions (`delete_*`, device restarts, firmware updates) affect
  real screens. Confirm with the human first when the request is ambiguous.
