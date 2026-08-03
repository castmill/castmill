# Node Modes: Web / Worker / Web+Worker

Castmill can run its background-job workers (video/image transcoding, etc.) as a
**separate, headless deployment** that is fully decoupled from the web/API
nodes. A worker fleet requires **only a PostgreSQL connection** — no Phoenix
endpoint and, critically, **no BEAM clustering / EPMD connectivity** with the
web nodes.

## Modes

The node role is selected with the `CASTMILL_NODE_MODE` environment variable
(or `config :castmill, :node_mode`):

| Mode                    | HTTP endpoint | BullMQ workers | Completion listener |
| ----------------------- | :-----------: | :------------: | :-----------------: |
| `web+worker` (default)  |      yes      |      yes       |         no          |
| `web`                   |      yes      |      no        |        yes          |
| `worker`                |      no       |      yes       |         no          |

- **`web+worker`** — the all-in-one node. This is exactly the historical
  behavior and what unset/legacy deployments get, so single-node deployments
  keep working unchanged.
- **`web`** — serves HTTP/WebSocket traffic and enqueues jobs, but consumes no
  heavy job queues itself. Live transcode updates arrive through the BullMQ
  QueueEvents completion listener (see below).
- **`worker`** — runs `Castmill.Repo`, the BullMQ Postgres connection and the
  configured queue workers, but does **not** start the HTTP endpoint (and skips
  web-only concerns such as widget JSON loading).

Unset / unrecognized values default to `web+worker`.

## How completion updates reach dashboards without clustering

When a transcode job finishes, the dashboard needs the live
`resource:media:<id>` update. In the all-in-one topology the worker is
co-located with the web tier and broadcasts it directly over `Castmill.PubSub`.

In a split topology the worker and web tiers share only PostgreSQL, so a direct
`Phoenix.PubSub` broadcast on the worker would never reach the web node. Instead:

1. The transcoder's `process/1` returns a **structured result**
   (`{:ok, %{"media_id" => ..., "status" => ..., "status_message" => ...,
   "files" => ..., "size" => ...}}`). BullMQ stores this as the job's
   `returnvalue`.
2. BullMQ streams `:completed` / `:failed` events **through PostgreSQL**
   (`BullMQ.Backends.Postgres`).
3. On `web` nodes, `Castmill.Workers.TranscoderEventsHandler` (started via
   `BullMQ.QueueEvents`) consumes those events and performs the
   `resource:media:<id>` PubSub broadcast **locally**, which reaches connected
   dashboards through the normal `CastmillWeb.ResourceUpdatesChannel`.

On `:failed`, there is no return value, so the media id is derived from the
deterministic job id (`video_transcode:<media_id>` / `image_transcode:<media_id>`)
and the failure reason is taken from `failedReason`.

### Exactly one broadcast per topology

The QueueEvents listener is started **only** in `web` mode. In `web+worker` mode
the co-located worker already broadcasts directly, so the listener is not
started there — guaranteeing exactly one delivery path (no duplicates).

## Configuration

- `CASTMILL_NODE_MODE` — `web+worker` (default) | `web` | `worker`.
- Per-node queue consumption is driven by `config :castmill, :bullmq, queues:`.
  A `web` node consumes no heavy queues; `worker` nodes consume
  `video_transcoder` / `image_transcoder` (and the others).
- `config :castmill, :bullmq, completion_event_queues:` — the queues a `web`
  node listens to for completion/failure events (default:
  `[:video_transcoder, :image_transcoder]`).
- Worker nodes still need the BullMQ Postgres configuration
  (`BULLMQ_DATABASE_URL` / `BULLMQ_DB_SCHEMA` / `DATABASE_URL`). See
  `BULLMQ_POSTGRES_OPERATIONS.md`.

## Example deployments

Single node (unchanged, default):

```bash
# CASTMILL_NODE_MODE unset -> web+worker
bin/castmill start
```

Split tiers sharing only PostgreSQL:

```bash
# Web tier
CASTMILL_NODE_MODE=web    PHX_SERVER=true bin/castmill start

# Worker fleet (can be on separate/beefier hardware, different DC/cloud)
CASTMILL_NODE_MODE=worker bin/castmill start
```
