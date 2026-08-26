# Legacy Player Migration Solution

## Goal

Migrate legacy Android and Electron players from the old Castmill service to the
new Castmill platform one device at a time, without changing the URL configured
on the installed players:

```text
https://player.castmill.io
```

The migration must be reversible and must leave devices on the old player when
the migration service is unavailable or the device has not been selected.

## Existing Building Blocks

The `legacy-adapter-player` package already bridges the native APIs exposed by
legacy Android and Electron wrappers to the modern `@castmill/device` player.
It:

- obtains the existing hardware identifier from the native wrapper;
- stores modern Castmill credentials through the legacy storage API;
- adapts restart, reboot, heartbeat, and player-ready messages;
- uses the modern registration, WebSocket, content, and playback flows; and
- targets Chromium 38 for old hardware compatibility.

The modern backend already identifies devices by `hardware_id`, supports PIN
registration, and can recover credentials for an existing device when recovery
is permitted.

## Why DNS Switching Is Insufficient

DNS and normal reverse-proxy rules can only route using information available
in the HTTP request. The legacy hardware identifier is not in that request. It
becomes available only after JavaScript loaded in the player communicates with
the native parent wrapper.

Pointing `player.castmill.io` directly at the adapter would therefore migrate
every device at once. Per-device migration requires a browser-side dispatcher
that reads the hardware identifier before choosing the old player or the
adapter.

## Proposed Architecture

Use three independently deployable origins:

| Origin | Responsibility |
| --- | --- |
| `player.castmill.io` | Lightweight migration dispatcher and unchanged URL configured on devices |
| `old-player.castmill.io` | Existing legacy player application |
| `adapter-player.castmill.io` | Built `legacy-adapter-player` application |

The exact fallback and adapter hostnames are deployment choices. They must use
HTTPS certificates supported by the legacy devices.

### Request Flow

1. A legacy player loads `player.castmill.io`.
2. The dispatcher detects the legacy Android or Electron wrapper.
3. It requests the hardware identifier through the existing native message
   bridge.
4. It asks a migration-control endpoint whether that identifier is enabled.
5. It replaces the current frame location:
   - enabled devices go to `adapter-player.castmill.io`;
   - disabled or unknown devices go to `old-player.castmill.io`.
6. Any timeout, unsupported platform, malformed response, or network failure
   falls back to the old player.

The dispatcher should redirect rather than embed the selected application in
another iframe. The adapter expects the native wrapper to remain its parent,
and adding another frame would change the message path.

### Migration Registry

The migration-control service needs a registry independent of the new
`devices` table. A device may need a migration decision before it has ever been
registered in new Castmill.

Each record should contain:

- legacy hardware identifier;
- migration state (`old` or `adapter`);
- optional target environment or adapter release;
- update timestamp; and
- optional operational note or audit metadata.

The endpoint should return only the routing decision required by the
dispatcher. It should be authenticated or otherwise protected against bulk
enumeration, rate limited, monitored, and designed so that an unavailable
registry cannot accidentally migrate devices.

### Adapter-to-Backend Traffic

The adapter must be built with the new Castmill API origin using the environment
variables consumed by `@castmill/device`, primarily
`VITE_DEFAULT_BASE_URL`. The current package README refers to
`VITE_BASE_URL`, which is not read by the device implementation and must be
corrected as part of deployment work.

There are two viable network arrangements:

1. Allow the adapter origin through backend CORS and connect its WebSocket
   directly to the API origin.
2. Reverse-proxy the API and WebSocket paths through the adapter origin and use
   same-origin URLs.

Same-origin proxying is preferable for very old browser engines because it
reduces CORS and TLS compatibility risk. Whichever approach is chosen must
cover registration, device REST endpoints, media and widget assets, and the
Phoenix `/socket` WebSocket.

## Migration Procedure

1. Confirm the device's legacy hardware identifier.
2. Ensure the device exists in new Castmill or plan to assign it using the PIN
   displayed by the adapter.
3. Enable that identifier in the migration registry.
4. Restart or reload the device.
5. Confirm that it reaches the adapter and registers or recovers successfully.
6. Validate content playback, media downloads, WebSocket commands, heartbeat,
   offline restart, and native restart/reboot controls.
7. Observe the device for an agreed validation period.
8. If validation fails, set its registry state back to `old` and reload it.

Migration state should remain explicit until the old service is retired.
Absence from the registry must mean `old`.

## Rollback and Failure Behaviour

- The dispatcher defaults to the old player.
- Migration-control failures must never default to the adapter.
- A global kill switch should make every dispatcher request choose the old
  player.
- Per-device rollback takes effect on the next page load.
- The old player deployment and its data must remain available throughout the
  migration period.
- Adapter releases should be immutable or versioned so a problematic release
  can be rolled back independently of migration state.

## Known Gaps to Resolve

- No production build or deployment pipeline currently publishes the adapter.
- The adapter README documents the wrong base URL variable.
- Backend CORS currently grants unrestricted origin access only to
  `/registrations`; the rest of the adapter flow needs an allowed origin or
  same-origin proxy.
- The adapter's XHR fetch polyfill rejects non-2xx responses, while the modern
  registration flow needs to inspect responses such as `403
  recovery_blocked`.
- WebOS falls back to browser implementations and is not supported as a legacy
  native integration.
- Android file downloads pass authorization in a query parameter because the
  legacy API cannot set headers. Deployment logs and intermediaries must not
  retain that value.
- Native bridge compatibility, TLS support, media codecs, storage behaviour,
  and offline playback must be verified on representative physical hardware.
- The existing bridge uses wildcard `postMessage` targets. The dispatcher and
  adapter should validate message sources and origins as far as the native
  wrappers permit.

## Work Breakdown

The following chunks are intentionally small enough to assign to separate
Copilot tasks. Later chunks should not begin until their listed dependencies
are complete.

### 1. Verify the Legacy Wrapper Contract

**Scope**

- Obtain representative Android and Electron legacy application versions.
- Document their initial URL/frame structure, user agents, message formats,
  hardware identifier APIs, reload behaviour, and TLS limitations.
- Confirm whether the old management system can remotely change an individual
  player's URL. If it can, compare direct per-device URL changes with the
  dispatcher approach.

**Deliverable**

- A compatibility matrix and captured contract tests or fixtures for every
  supported wrapper version.

**Acceptance**

- Hardware identifiers can be read reliably before routing.
- A redirect preserves communication with the native parent.
- Unsupported versions are identified and remain on the old player.

### 2. Make the Adapter Production-Ready

**Scope**

- Correct base URL documentation and define production environment variables.
- Fix fetch-polyfill response semantics needed by registration and recovery.
- Add tests for non-2xx responses and relevant native bridge behaviour.
- Address safe message source/origin validation without breaking verified
  wrappers.
- Decide explicitly whether WebOS is unsupported or requires an implementation.

**Dependencies**

- Legacy wrapper contract.

**Acceptance**

- Adapter lint, tests, and production build pass.
- Registration, recovery-blocked handling, login, and playback work on each
  supported wrapper.

### 3. Package and Deploy the Adapter

**Scope**

- Add a reproducible production build and artifact.
- Deploy versioned static assets to the adapter origin.
- Configure HTTPS, cache headers, source-map policy, health checks, and release
  rollback.
- Configure direct CORS/WebSocket access or same-origin API proxying.

**Dependencies**

- Production-ready adapter.

**Acceptance**

- A legacy device can complete the full adapter flow against a staging backend.
- A previous adapter release can be restored without changing dispatcher state.

### 4. Implement Migration Control

**Scope**

- Add the migration registry and its operational management interface.
- Add a minimal lookup endpoint for the dispatcher.
- Add audit logging, authorization, rate limiting, validation, and a global
  kill switch.
- Ensure unknown identifiers and all internal failures resolve to `old`.

**Dependencies**

- A decision on where migration state is operated and audited.

**Acceptance**

- Operators can enable and disable one identifier.
- Lookup failure and kill-switch tests prove that the result is always `old`.
- Registry changes are auditable.

### 5. Implement and Deploy the Dispatcher

**Scope**

- Build a Chromium-38-compatible static dispatcher.
- Reuse the verified Android and Electron hardware-identifier bridges.
- Add strict timeouts, old-player fallback, loop prevention, and telemetry.
- Deploy it to a staging hostname before changing `player.castmill.io`.

**Dependencies**

- Legacy wrapper contract.
- Migration-control endpoint.
- Reachable old-player and adapter origins.

**Acceptance**

- Enabled identifiers reach the adapter.
- Disabled, unknown, unsupported, malformed, and timed-out cases reach the old
  player.
- No redirect loops occur.

### 6. End-to-End Hardware Pilot

**Scope**

- Exercise at least one supported Android device and one supported Electron
  device.
- Test first registration, existing-device recovery, content playback, cached
  playback after network loss, downloads, commands, restart, and reboot.
- Test per-device and global rollback.
- Record logs and operational dashboards needed for rollout.

**Dependencies**

- Staging dispatcher, registry, adapter, backend, and old-player deployment.

**Acceptance**

- All critical flows pass on physical hardware.
- Rollback restores the old player on the next reload.
- Operators can distinguish dispatcher, adapter, backend, and native-wrapper
  failures.

### 7. Production Rollout

**Scope**

- Preserve the current player service at the fallback origin.
- Move `player.castmill.io` to the dispatcher.
- Start with internal or low-risk devices, then enable devices individually.
- Define rollout gates, observation periods, incident ownership, and retirement
  criteria for the old service.

**Dependencies**

- Successful hardware pilot and approved rollback runbook.

**Acceptance**

- Non-migrated devices continue using the old player without behavioural
  change.
- Each migrated device can be independently observed and rolled back.
- The old service is retired only after the remaining population reaches zero
  and the retention period has elapsed.

## Alternative: Direct Per-Device URL Change

If the old management platform can safely update and reload the URL of one
installed player at a time, selected devices can be pointed directly to the
adapter origin. This removes the dispatcher and migration-control lookup from
the critical path. It still requires all adapter production-readiness,
deployment, backend connectivity, hardware testing, and rollback work above.

This alternative should be selected only after the legacy wrapper contract
confirms that URL changes are reliable, remotely reversible, and supported for
the complete installed population.
