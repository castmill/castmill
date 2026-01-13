# Migration: Oban to BullMQ

## Overview

This document describes the migration from Oban to BullMQ for background job processing in the Castmill platform.

## Why BullMQ?

BullMQ offers several advantages over Oban:

1. **More Complete Feature Set**: Advanced job management features including job priorities, delays, retries, and rate limiting
2. **Cross-Platform Compatibility**: Full interoperability with Node.js BullMQ workers
3. **Larger Ecosystem**: Broader community support and more integrations
4. **Redis-Based**: No database tables required; all job data stored in Redis
5. **Better Observability**: Built-in telemetry and monitoring capabilities

## Prerequisites

Before deploying this change, ensure:

1. **Redis is available**: Redis 7+ should be running and accessible
2. **Environment variables** (for production):
   - `REDIS_HOST` (default: localhost)
   - `REDIS_PORT` (default: 6379)

## Changes Made

### 1. Dependencies

**Removed:**
- `{:oban, "~> 2.17"}`

**Added:**
- `{:bullmq, "~> 1.2"}`
- `{:redix, "~> 1.3"}`

### 2. Infrastructure

Added Redis service to `docker-compose.yaml`:
```yaml
redis:
  image: redis:7-alpine
  ports:
    - '6379:6379'
  volumes:
    - redis_data:/data
  command: redis-server --appendonly yes
```

### 3. Configuration

**config/config.exs:**
```elixir
config :castmill, :redis,
  host: System.get_env("REDIS_HOST") || "localhost",
  port: String.to_integer(System.get_env("REDIS_PORT") || "6379")

config :castmill, :bullmq,
  connection: :castmill_redis,
  queues: [
    {:image_transcoder, concurrency: 10},
    {:video_transcoder, concurrency: 10},
    {:integration_polling, concurrency: 5},
    {:integrations, concurrency: 5},
    {:maintenance, concurrency: 2}
  ]
```

**config/test.exs:**
```elixir
config :castmill, :bullmq, testing: :inline
```

### 4. Workers Converted

All 7 workers have been converted from Oban to BullMQ:

1. **EncryptionRotation** - Background re-encryption during key rotation
2. **IntegrationDataCleanup** - Periodic cleanup of stale integration data
3. **ImageTranscoder** - Image transcoding to multiple sizes
4. **VideoTranscoder** - Video transcoding to multiple resolutions
5. **IntegrationPoller** - PULL-mode integrations with API keys
6. **SpotifyPoller** - Spotify API polling for OAuth integrations
7. **BullMQHelper** - Helper module for unified job scheduling

**Key Changes:**
- Workers now implement `process(%BullMQ.Job{})` instead of `perform(%Oban.Job{})`
- Job data accessed via `job.data` instead of `job.args`
- Scheduling now uses `BullMQHelper.add_job/4` or worker-specific `schedule*` functions

### 5. Application Supervisor

The application supervisor now:
- Conditionally starts Redis connection (only in non-test environments)
- Starts BullMQ workers with intelligent job routing
- Routes jobs to correct workers based on queue name and job type
- Skips Redis/BullMQ in test mode (uses inline execution)

### 6. Testing

Tests have been updated to:
- Remove `use Oban.Testing`
- Use `BullMQ.Job` structs instead of `Oban.Job`
- Run jobs inline automatically (no need for `Testing.with_testing_mode`)

## Migration Steps

### Development

1. Pull the latest code:
   ```bash
   git pull origin main
   ```

2. Install dependencies:
   ```bash
   cd packages/castmill
   mix deps.get
   ```

3. Start Redis (if not already running):
   ```bash
   docker-compose up -d redis
   ```

4. Run migrations:
   ```bash
   mix ecto.migrate
   ```
   This will remove the Oban tables from the database.

5. Run tests:
   ```bash
   mix test
   ```

6. Start the application:
   ```bash
   mix phx.server
   ```

### Production

1. **Prepare Redis:**
   - Ensure Redis 7+ is deployed and accessible
   - Configure firewall rules if needed
   - Set up Redis persistence (AOF recommended)

2. **Set Environment Variables:**
   ```bash
   export REDIS_HOST=your-redis-host
   export REDIS_PORT=6379
   ```

3. **Deploy Code:**
   - Deploy the updated application code
   - Ensure the new dependencies are included in the release

4. **Run Migration:**
   ```bash
   mix ecto.migrate
   ```
   **⚠️ Warning:** This will drop the `oban_jobs` table. Any pending Oban jobs will be lost.

5. **Restart Application:**
   - Restart the application to start using BullMQ
   - Monitor logs for any errors

6. **Verify:**
   - Upload a test image/video to trigger transcoding jobs
   - Check Redis to see jobs being processed:
     ```bash
     redis-cli
     > KEYS bull:*
     ```

## Breaking Changes

### 1. Pending Jobs

**⚠️ IMPORTANT**: Pending Oban jobs in the database will NOT be migrated to BullMQ. They will be lost when the `oban_jobs` table is dropped.

**Mitigation:**
- Before migrating, ensure all critical jobs have completed
- Consider draining the Oban queue before migration:
  ```elixir
  # In production, wait for jobs to complete
  Oban.drain_queue(queue: :image_transcoder)
  Oban.drain_queue(queue: :video_transcoder)
  # ... repeat for all queues
  ```

### 2. Redis Dependency

The application now requires Redis to be running. If Redis is unavailable:
- In production: The application will fail to start
- In test mode: Jobs run inline, Redis not required

### 3. Job Cancellation

Job cancellation (e.g., `IntegrationPoller.cancel_polling/2`) is currently limited:
- **Oban**: Used SQL queries to find and cancel jobs
- **BullMQ**: Would require enumerating jobs in Redis
- **Current**: Logs a warning but doesn't cancel jobs

This may be improved in future updates.

## Rollback Plan

If issues arise, you can rollback:

1. **Revert Code:**
   ```bash
   git revert <migration-commit-hash>
   ```

2. **Update Dependencies:**
   ```bash
   mix deps.get
   ```

3. **Restore Oban Tables:**
   ```bash
   mix ecto.rollback
   ```

4. **Restart Application**

**Note:** Jobs created in BullMQ will not be transferred back to Oban.

## Monitoring

### BullMQ Dashboard (Optional)

Consider setting up Bull Dashboard or Bull Board for visual monitoring:

**Bull Board (Node.js):**
```javascript
// In a separate Node.js app
const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter } = require('@bull-board/express');
const { Queue } = require('bullmq');

const serverAdapter = new ExpressAdapter();
createBullBoard({
  queues: [
    new BullMQAdapter(new Queue('image_transcoder')),
    new BullMQAdapter(new Queue('video_transcoder')),
    // ... add all queues
  ],
  serverAdapter
});
```

### Redis Monitoring

Monitor Redis performance:
```bash
# Check memory usage
redis-cli INFO memory

# Monitor commands in real-time
redis-cli MONITOR

# Check queue lengths
redis-cli LLEN bull:image_transcoder:wait
```

## Troubleshooting

### Application Won't Start

**Error:** `Could not connect to Redis`

**Solution:**
- Verify Redis is running: `redis-cli ping`
- Check `REDIS_HOST` and `REDIS_PORT` environment variables
- Verify network connectivity

### Jobs Not Processing

**Symptom:** Jobs are added but never complete

**Checks:**
1. Verify BullMQ workers are running:
   ```elixir
   # In IEx
   Supervisor.which_children(Castmill.Supervisor)
   ```

2. Check Redis for stuck jobs:
   ```bash
   redis-cli LLEN bull:image_transcoder:wait
   redis-cli LLEN bull:image_transcoder:active
   redis-cli LLEN bull:image_transcoder:failed
   ```

3. Review application logs for errors

### Tests Failing

**Error:** Tests timeout or fail unexpectedly

**Solution:**
- Ensure `config :castmill, :bullmq, testing: :inline` is set in `test.exs`
- Check that test files use `BullMQ.Job` format, not `Oban.Job`
- Verify no `use Oban.Testing` in test files

## Additional Resources

- [BullMQ Elixir Documentation](https://hexdocs.pm/bullmq/)
- [BullMQ Guide (Node.js, concepts apply)](https://docs.bullmq.io/)
- [Redis Documentation](https://redis.io/documentation)

## Support

For issues or questions about this migration:
1. Check this document first
2. Review application logs
3. Check Redis logs
4. Contact the development team
