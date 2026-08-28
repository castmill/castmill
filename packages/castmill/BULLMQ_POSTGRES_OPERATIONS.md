# BullMQ v2 PostgreSQL Setup and Operations

## Purpose

This document describes the current background-job setup used by released Castmill versions.

Castmill uses BullMQ v2 with PostgreSQL backend. This is not an Oban migration runbook.

## Current Architecture

1. BullMQ backend: `BullMQ.Backends.Postgres`
2. Dedicated BullMQ connection process: `BullMQ.Backends.Postgres.Connection`
3. BullMQ schema defaults to `bullmq`
4. Test mode supports inline execution (`config :castmill, :bullmq, testing: :inline`)

## Runtime Configuration

Required/important environment variables in production:

1. `BULLMQ_DATABASE_URL` (recommended, can be a dedicated DB)
2. `BULLMQ_DB_SCHEMA` (default: `bullmq`)
3. `BULLMQ_DB_POOL_SIZE` (default: `10`)
4. `BULLMQ_DB_SSL` (default: `false`) — set to `true` when the database enforces
   SSL, e.g. AWS RDS with `rds.force_ssl=1`. Without it the BullMQ connection is
   rejected with `no pg_hba.conf entry ... no encryption`.
5. `BULLMQ_DB_SSL_VERIFY` (default: `verify_none`) — peer verification mode when
   SSL is enabled: `verify_none` (managed CA, no local cert needed) or
   `verify_peer`.

If `BULLMQ_DATABASE_URL` is not provided, Castmill falls back to `DATABASE_URL`.

> **Note:** SSL applies to the BullMQ connection independently of the main
> `Castmill.Repo`. Enable `BULLMQ_DB_SSL=true` alongside the main DB SSL settings
> whenever the target database requires encrypted connections.

## Development Setup

1. Install dependencies:

```bash
cd packages/castmill
mix deps.get
```

2. Ensure PostgreSQL is running and a BullMQ database exists (example):

```bash
createdb castmill_bullmq_dev
```

3. Run app migrations:

```bash
mix ecto.migrate
```

4. Start app:

```bash
mix phx.server
```

## Worker Behavior Notes

1. Stalled recovery is two-phase in PostgreSQL backend:
   - First pass marks active jobs (`stalled_marked = true`)
   - Later pass reclaims still-expired/active jobs
2. Stalled checks are throttled via queue meta (`stalled-check`), so transitions are not immediate.
3. Jobs that stall over threshold use deferred failure semantics and are finalized to `failed` on next pickup.

## Node Modes (web / worker / web+worker)

Workers can run as a separate, headless deployment decoupled from the web tier,
sharing only PostgreSQL (no BEAM clustering required). This is selected with the
`CASTMILL_NODE_MODE` environment variable (`web+worker` default, `web`,
`worker`). Completion/failure updates from queues not processed on a web-capable
node reach dashboards via a `BullMQ.QueueEvents` listener that consumes events
through PostgreSQL.

See [`NODE_MODES.md`](NODE_MODES.md) for full details.

## Scheduler ID Rule

BullMQ scheduler IDs must have fewer than 5 colon-separated parts.

Why:

1. `< 5` parts: treated as new-style scheduler IDs
2. `>= 5` parts: treated as legacy repeatable IDs

Safe pattern:

```elixir
sanitized_discriminator = String.replace(discriminator_id || "", ":", "_")
scheduler_id = "int_poll_#{org_id}_#{integration_id}_#{sanitized_discriminator}"
```

## Monitoring

### PostgreSQL Health

```sql
SELECT application_name, state, count(*)
FROM pg_stat_activity
WHERE datname = 'castmill_bullmq_dev'
GROUP BY application_name, state;
```

```sql
SELECT schemaname, relname, n_live_tup
FROM pg_stat_user_tables
WHERE schemaname = 'bullmq'
ORDER BY n_live_tup DESC;
```

### Queue Event Timeline

```sql
SELECT id, event, data, created_at_ms
FROM bullmq.event
WHERE queue = 'email' AND data->>'jobId' = '1'
ORDER BY created_at_ms DESC
LIMIT 100;
```

## Troubleshooting

### App Starts But Jobs Do Not Complete

1. Verify workers are running:

```elixir
Supervisor.which_children(Castmill.Supervisor)
```

2. Confirm BullMQ schema objects exist in target DB/schema.
3. Inspect `bullmq.job` for lock and stalled fields (`state`, `lock_token`, `locked_until_ms`, `stalled_count`, `deferred_failure`).
4. Inspect recent queue events in `bullmq.event`.

### Connection Errors

1. Verify `BULLMQ_DATABASE_URL` (or fallback `DATABASE_URL`)
2. Verify DB user permissions for schema/functions
3. Verify network reachability and PostgreSQL status

## Historical Note

Some internal docs and comments may still reference Oban from earlier development history.
Those references do not represent currently released runtime behavior.

## References

1. BullMQ Elixir docs: https://hexdocs.pm/bullmq/
2. BullMQ concepts: https://docs.bullmq.io/
3. PostgreSQL docs: https://www.postgresql.org/docs/
