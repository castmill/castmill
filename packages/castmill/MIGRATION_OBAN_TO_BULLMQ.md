# Migration: Oban to BullMQ (PostgreSQL backend)

## Purpose

This document is the migration runbook for moving Castmill background jobs from Oban to BullMQ.

For day-2 operations, monitoring, and troubleshooting after cutover, use:

- `packages/castmill/BULLMQ_POSTGRES_OPERATIONS.md`

## Migration Scope

The migration replaces Oban workers with BullMQ workers backed by PostgreSQL.

## Cutover Checklist

1. Deploy code containing BullMQ worker and supervisor changes.
2. Configure BullMQ runtime environment variables:
   - `BULLMQ_DATABASE_URL` (optional; falls back to `DATABASE_URL`)
   - `BULLMQ_DB_SCHEMA` (default: `bullmq`)
   - `BULLMQ_DB_POOL_SIZE` (default: `10`)
3. Run database migrations.
4. Verify BullMQ workers start successfully and process queued jobs.
5. Confirm no Oban jobs remain in active use.

## Validation

After cutover:

1. Schedule representative jobs for each queue.
2. Confirm jobs move through waiting/active/completed states.
3. Confirm failed jobs are retried according to worker settings.

## Rollback

If critical issues are detected during cutover, redeploy the previous release and restore previous worker processing configuration.
