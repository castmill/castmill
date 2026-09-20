# Device Error Reporting

## Scope

Player devices report actionable playback and device failures, plus uncaught
runtime exceptions and unhandled promise rejections. The reporting system does
not capture arbitrary `console.error` output because dependency and platform
noise would make device diagnostics expensive and unreliable.

Captured runtime errors and handled video playback rejections are also written
to the local browser console. Diagnostics reporting augments normal local
debugging; it does not hide failures from developers.

The dashboard displays these reports in the existing device **Events** tab.
Repeated matching errors are one grouped event with an occurrence count and
first/last observed timestamps.

## Data flow

1. `@castmill/player` reports playback failures, including rejected template-video
   `play()` promises, and emits layer show failures.
2. `@castmill/device` sends those failures, selected device/cache/sync failures,
   and global runtime failures to `DeviceErrorReporter`.
3. The reporter sanitizes input, aggregates it by a stable fingerprint, and
   writes a small versioned buffer to device-scoped Web Storage
   (`localStorage`) under `castmill.device-error-buffer:<device-id>`.
4. When the authenticated `devices:<device_id>` channel is joined, it sends
   bounded `errors:report` batches and removes aggregates only after the
   channel acknowledges them.
5. `CastmillWeb.DevicesChannel` validates the batch using the socket-assigned
   device identity. `Castmill.Devices.upsert_error_reports/3` idempotently
   upserts grouped error rows in `devices_events`.
6. The Events REST API returns paginated groups newest first by default, and
   the dashboard can show the sanitized stack and whitelisted context in a
   details modal.

## Resource limits

`packages/device/src/classes/error-reporter.ts` owns the client limits:

| Limit | Value |
| --- | ---: |
| Distinct buffered fingerprints | 50 |
| Serialized buffer size | 64 KiB |
| Buffered report age | 7 days |
| Error message | 1 KiB |
| Stack trace | 4 KiB |
| Reports per batch | 20 |
| Batch payload | 32 KiB |
| Sparse-report flush interval (≤5/minute) | 1 second |
| Medium-pressure flush interval (6–20/minute) | 5 seconds |
| High-pressure flush interval (21–60/minute) | 15 seconds |
| Maximum flush interval (>60/minute) | 60 seconds |
| Full report processing rate | 120/minute (burst of 20) |
| Local storage checkpoint debounce | 5 seconds |

The device evicts the least-recent aggregate when either local buffer limit is
exceeded. It also limits full sanitization, fingerprinting, and aggregation to
120 reports per minute after an initial burst of 20. The discarded occurrence
quantity from either guard is sent as a grouped `overflow` event. This makes
intentional diagnostic loss visible without retaining raw individual reports
or letting an error loop consume device CPU.

The reporter does not use the `Machine` settings API because error aggregation
is updated far more often than device configuration. If Web Storage is
unavailable or throws (for example, due to platform policy), reporting
continues in memory for the current session but cannot survive a reload.

After an authenticated/reconnect flush, the first new error is sent
immediately if no batch was sent recently. Subsequent delivery uses a rolling
one-minute pressure window: sparse reports wait one second, while sustained
error volume progressively coalesces reports for five, 15, and finally 60
seconds. Retries reuse the exact same report IDs and use exponential backoff,
so a loop cannot turn successful acknowledgements into per-error
WebSocket/database writes.

The backend validates the same batch/message/stack bounds, keeps at most 100
event rows per device, and prunes once after an insert batch rather than
counting and pruning for every individual occurrence.

## Privacy and safe context

Reports contain only a category, optional code, sanitized message, truncated
stack, occurrence range, and a whitelisted context:

- `playlistId`
- `layerId` / `layerName`
- `widgetId`
- `mediaId`
- `appVersion`

URLs are stripped of query strings and fragments. Keys resembling
authorization, token, password, secret, credential, or cookie are rejected
from context. Never add playlist/widget configurations, credentials, media
contents, request bodies, screenshots, or arbitrary thrown objects.

## Delivery guarantees

Delivery is best-effort and at-least-once. Each sent aggregate receives an
immutable report ID; the database stores the last accepted ID for each
fingerprint, so a lost channel acknowledgement can be retried without
incrementing its occurrence count twice. Reporting errors are deliberately
isolated from playback and must never block player startup, playback,
reconnect, or shutdown.

## Relevant files

- `packages/device/src/classes/error-reporter.ts`
- `packages/device/src/classes/device.ts`
- `packages/player/src/player.ts`
- `packages/player/src/layer.ts`
- `packages/castmill/lib/castmill_web/channels/devices_channel.ex`
- `packages/castmill/lib/castmill/devices.ex`
- `packages/castmill/lib/castmill/addons/devices/components/device-events.tsx`
