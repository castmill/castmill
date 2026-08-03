# Node Modes: Web / Worker / Web+Worker

Castmill can run its background-job workers (video/image transcoding, etc.) as a
**separate, headless deployment** that is fully decoupled from the web/API
nodes. A worker fleet requires **only a PostgreSQL connection** — no Phoenix
endpoint and, critically, **no BEAM clustering / EPMD connectivity** with the
web nodes.

## Modes

The node role is selected with the `CASTMILL_NODE_MODE` environment variable
(or `config :castmill, :node_mode`):

| Mode                   | HTTP endpoint | BullMQ workers | Completion listeners |
| ---------------------- | :-----------: | :------------: | :------------------: |
| `web+worker` (default) |      yes      |      yes       | non-local queues only |
| `web`                  |      yes      |       no       | all configured queues |
| `worker`               |      no       |      yes       |          no           |

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

When a background job finishes, the dashboard often needs a live update (for a
transcode job, the `resource:media:<id>` update). In the all-in-one topology the
worker is co-located with the web tier and broadcasts it directly over
`Castmill.PubSub`.

In a split topology the worker and web tiers share only PostgreSQL, so a direct
`Phoenix.PubSub` broadcast on the worker would never reach the web node. Instead:

1. The worker's `process/1` returns a **structured result** (for the
   transcoders: `{:ok, %{"media_id" => ..., "status" => ..., "status_message"
   => ..., "files" => ..., "size" => ...}}`). BullMQ stores this as the job's
   `returnvalue`.
2. BullMQ streams `:completed` / `:failed` events **through PostgreSQL**
   (`BullMQ.Backends.Postgres`).
3. On web-capable nodes that do not process that queue locally, a
   `BullMQ.QueueEvents.Handler` (started via
   `BullMQ.QueueEvents`) consumes those events and performs the PubSub broadcast
   **locally**, which reaches connected dashboards through the normal channel
   (for media, `CastmillWeb.ResourceUpdatesChannel`).

For the transcoders this handler is `Castmill.Workers.TranscoderEventsHandler`.
On `:failed`, there is no return value, so the media id is derived from the
deterministic job id (`video_transcode:<media_id>` / `image_transcode:<media_id>`)
and the failure reason is taken from `failedReason`.

### Adding other workers

The listener mechanism is **not transcoder-specific**. Any worker that runs on a
separate fleet and needs to notify the web tier (e.g. widget upload processing)
can plug in by:

1. Returning a structured `{:ok, map}` result from its `process/1` so the
   payload travels in the job `returnvalue`.
2. Implementing a `BullMQ.QueueEvents.Handler` that re-broadcasts on the
   appropriate `Castmill.PubSub` topic.
3. Registering its queue in `completion_event_queues` as a
   `{queue, handler_module}` tuple (a bare atom uses the transcoder handler).

### Exactly one broadcast per topology

For each web-capable node, listeners are derived from configuration:

```
listener_queues = completion_event_queues - locally_processed_queues
```

A co-located worker broadcasts directly, so its queue is excluded from the
listener set. This guarantees exactly one delivery path per queue on a node. A
default `web+worker` node processes all queues and therefore starts no listeners.

## Configuration

- `CASTMILL_NODE_MODE` — `web+worker` (default) | `web` | `worker`.
- Per-node queue consumption is driven by `config :castmill, :bullmq, queues:`.
  A `web` node consumes no heavy queues; `worker` nodes consume
  `video_transcoder` / `image_transcoder` (and the others).
- `config :castmill, :bullmq, completion_event_queues:` — queues whose
  completion/failure events a web-capable node listens to when it does not
  process them locally (default:
  `[:video_transcoder, :image_transcoder]`). Entries may be a bare queue atom
  (uses `Castmill.Workers.TranscoderEventsHandler`) or a
  `{queue, handler_module}` tuple to register a handler for other workers.
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

Web app with light queues and a separate transcoder fleet:

```elixir
# Web app config
config :castmill, :node_mode, :web_worker

config :castmill, :bullmq,
  queues: [
    {:integration_polling, concurrency: 5},
    {:integrations, concurrency: 5},
    {:maintenance, concurrency: 2},
    {:email, concurrency: 5}
  ],
  completion_event_queues: [:video_transcoder, :image_transcoder]

# Transcoder fleet config
config :castmill, :node_mode, :worker

config :castmill, :bullmq,
  queues: [
    {:image_transcoder, concurrency: 10},
    {:video_transcoder, concurrency: 10}
  ],
  completion_event_queues: [:video_transcoder, :image_transcoder]
```

Both tiers use the same BullMQ PostgreSQL database. The web app runs the light
queues locally and listens for the two offloaded transcoder queues; the
transcoder nodes exclude both listeners because they process those queues
locally. No BEAM distribution or EPMD connectivity is required.
