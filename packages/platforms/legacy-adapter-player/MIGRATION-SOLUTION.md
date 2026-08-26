# Legacy Player Migration Solution

## Goal

Migrate legacy Android and Electron players from old Castmill to new Castmill
one player at a time without changing the URL installed on the players:

```text
https://player.castmill.io
```

Migration must be reversible from Dooh. Players that have not been selected,
and players for which migration state cannot be determined, must continue to
run the old player.

## Proposed Architecture

Keep the current player server at `player.castmill.io` in front of the fleet
during migration. Add a `migrated` boolean to each player in old Castmill and
make that field the source of truth for routing.

| URL | Responsibility during migration |
| --- | --- |
| `player.castmill.io` | Existing player server, migration decision, old player, and reverse proxy |
| `castmill.net/legacy` | Canonical deployment of the legacy adapter |
| `player.castmill.io/legacy/` | Same-origin proxy of `castmill.net/legacy` for migrated players |

The default value of `migrated` must be `false`. Dooh gets a checkbox for
changing it. After the update has committed, Dooh schedules a player refresh so
that the selected application is loaded.

### Feasibility Verdict

This design is conditionally feasible, with two important implementation
requirements that must be proven against the private old server and Dooh code:

1. The migration decision can only be made after the old server can securely
   identify the player.
2. Dooh must be able to refresh a player in both directions, including a player
   that is already running the new adapter and no longer connected to the old
   player application's control channel.

The public
[legacy Electron wrapper](https://github.com/OptimalBits/castmill-electron-old/blob/master/src/render-services/frame.ts)
loads the same fixed URL for every device:

```text
iframe.src = getConfig().playerUrl
```

The hardware identifier is exposed only after loaded JavaScript sends
`getEnvironment` to the native parent. Therefore a plain first
`GET https://player.castmill.io/` does not contain the hardware identifier in
its URL. An HTTP reverse proxy cannot select a player row from that request
unless the existing old server already receives a trustworthy player identity,
for example through an existing session cookie.

The old server implementation and Dooh are not part of this repository, so
their identity/session and refresh mechanisms must be confirmed before
implementation. The plan below supports either result:

- If the initial request has an existing server-verifiable player session, the
  server can check `migrated` immediately.
- Otherwise, the old bootstrap first performs its existing player
  authentication, asks the server to create a short-lived signed routing
  session, then navigates the iframe to `/legacy/` when `migrated` is true. The
  `/legacy/` route independently verifies the routing session and flag before
  proxying; it must not trust a player ID supplied only by the browser.

This is still server-controlled per-player migration. It does not require a
separate migration registry or a new dispatcher service.

## Request Flow

### Non-Migrated Player

1. The native wrapper loads `https://player.castmill.io`.
2. The old player server or bootstrap securely identifies the player.
3. The player record has `migrated = false`.
4. The existing old player application continues unchanged.

Failure to identify the player, read its record, or evaluate the flag must use
this path.

### Migrated Player

1. The native wrapper loads `https://player.castmill.io`.
2. The old player server or bootstrap securely identifies the player.
3. The player record has `migrated = true`.
4. The iframe navigates to `https://player.castmill.io/legacy/`.
5. The old player server verifies the player identity and flag again.
6. The old server reverse-proxies the request to
   `https://castmill.net/legacy/`.
7. The adapter obtains the hardware identifier from the unchanged native
   parent and connects to new Castmill.

Serving the adapter through the old origin preserves the wrapper's direct
parent/iframe relationship and avoids introducing another browser frame.
It also preserves origin-scoped browser storage during the migration phase.

### Proxy Requirements

The proxy must:

- proxy HTML and all adapter assets under a consistent `/legacy/` prefix;
- keep routing sticky for the document, JavaScript, CSS, and other subresource
  requests without sharing one player's decision with another;
- strip or rewrite the prefix when forwarding to `castmill.net/legacy`;
- rewrite upstream redirects and cookie paths if the upstream emits them;
- preserve the original scheme and forwarding headers;
- use timeouts and bounded retries;
- return to the old bootstrap on an adapter routing failure where possible;
- avoid caching migration decisions across players;
- ensure `/legacy/` requests cannot bypass the `migrated` check; and
- redact authorization query parameters used by legacy Android downloads from
  access logs.

The adapter's Vite `base` is currently relative, which is compatible with a
sub-path in principle, but the production build must be tested through the
actual proxy. Deep asset URLs, media, widgets, service workers, and redirects
must not escape the intended route.

The adapter must use the new Castmill API origin through
`VITE_DEFAULT_BASE_URL` or through explicitly proxied API routes. The package
README currently refers to `VITE_BASE_URL`, which is not read by
`@castmill/device` and must be corrected.

## Dooh Workflow

Add a **Migrated to new Castmill** checkbox to the player editor in Dooh.

The update operation must:

1. authorize the operator to edit the player;
2. persist the new `migrated` value;
3. record who changed it and when;
4. wait until the transaction has committed;
5. schedule a refresh after a short configurable delay; and
6. report the flag update and refresh-delivery result separately.

A default delay of five seconds is a reasonable starting point. Prefer a
refresh command acknowledgement over a longer arbitrary delay when the control
channel supports acknowledgements.

### Refresh in Both Directions

The two transitions use different running applications:

- `false` to `true`: the player is connected to old Castmill, so the existing
  old-player refresh command can be used.
- `true` to `false`: the player is running the adapter and communicating with
  new Castmill. The old player application's refresh channel may no longer be
  connected.

Before rollout, implement and test one reliable rollback refresh path:

1. Dooh calls an authenticated new-Castmill command endpoint for the mapped
   device; or
2. a small migration control channel remains connected while the adapter runs;
   or
3. the adapter periodically checks the old migration state and reloads when it
   changes.

The first option is preferred when old and new player records can be mapped
reliably by hardware identifier. It avoids permanent polling and keeps refresh
an explicit operator action. If refresh delivery fails, Dooh should retain the
saved flag, show the failure, and allow retry. The wrapper watchdog or a manual
restart remains the last-resort path.

On reload, `/legacy/` must re-check `migrated`. When it is false, it redirects
to `/`, allowing the old player to start again.

## Adapter Registration

The old `migrated` flag decides which application runs; it does not itself
register the player in new Castmill.

Before setting the flag, operators must either:

- pre-provision or map the corresponding device in new Castmill by hardware
  identifier; or
- be prepared to assign the registration PIN shown by the adapter.

The mapping between the old player record and the new device should use the
native hardware identifier and should be visible to the refresh integration
used for rollback.

## Migration Procedure

1. Confirm the player's legacy hardware identifier and wrapper version.
2. Confirm that the matching device can register or recover in new Castmill.
3. In Dooh, enable **Migrated to new Castmill**.
4. Wait for the delayed refresh and confirm `/legacy/` was selected.
5. Complete PIN assignment if the device was not pre-provisioned.
6. Validate playback, downloads, WebSocket commands, heartbeat, cached playback,
   and native restart/reboot controls.
7. Observe the player for the agreed validation period.
8. If validation fails, clear the checkbox.
9. Confirm that the rollback refresh reaches the adapter and that the next
   request returns to the old player.

## Failure Behaviour and Rollback

- `migrated` defaults to `false`.
- Missing identity, database errors, and invalid state select the old player.
- The old player remains served locally; it is not moved behind another
  dependency during migration.
- `/legacy/` verifies the flag on every document load and does not rely only on
  a previous browser decision.
- Dooh exposes the refresh status and supports retry.
- A global server-side kill switch makes all migration checks behave as false.
- Adapter releases are immutable or versioned and can be rolled back
  independently from player flags.
- The old service and database remain available until the migration is complete
  and the rollback retention period has elapsed.

## Final Cutover

When every player is migrated and the rollback period has passed:

1. Ensure `legacy.castmill.net` serves the same tested adapter deployment as
   `castmill.net/legacy`.
2. Configure it to accept requests whose HTTP `Host` is
   `player.castmill.io`.
3. Ensure the TLS endpoint presents a certificate valid for
   `player.castmill.io`; a DNS change alone does not change TLS or HTTP host
   requirements.
4. Test API, WebSocket, asset, media, widget, and native bridge behaviour through
   `legacy.castmill.net`.
5. Lower DNS TTL ahead of the change.
6. Point `player.castmill.io` at `legacy.castmill.net`.
7. Monitor until old DNS answers and caches have expired.
8. Retain the old player server for the agreed emergency rollback window.

At this stage the old `migrated` flags and Dooh checkbox no longer control
routing. Remove them only in a later cleanup after rollback is no longer
required.

## Known Gaps to Resolve

- The old player server and Dooh source are outside this repository. Their
  request identity, data model, authorization, command channel, and deployment
  must be inspected before choosing the exact implementation.
- The verified legacy Electron wrapper handles `getEnvironment`, `alive`,
  `player_ready`, and `player_name`, but not the adapter's restart or reboot
  messages. Those controls require a compatibility decision independent of
  migration routing.
- No production pipeline currently publishes this adapter to
  `castmill.net/legacy` or `legacy.castmill.net`.
- The adapter README documents the wrong API base URL variable.
- The adapter XHR fetch polyfill rejects non-2xx responses, while modern
  registration needs to inspect responses such as `403 recovery_blocked`.
- Backend CORS currently allows every origin only for `/registrations`. Serving
  the adapter through `player.castmill.io` does not by itself make requests to a
  different API origin same-origin.
- WebOS is detected but does not have a legacy native implementation.
- Android media downloads put authorization in a query parameter because the
  legacy native API cannot set headers.
- The existing bridge uses wildcard `postMessage` targets. Message source and
  origin checks should be tightened as far as verified wrappers permit.
- TLS support, codecs, storage, proxy caching, and offline playback require
  tests on representative physical hardware.

## Copilot-Sized Work Breakdown

The old player server and Dooh work belongs in their respective repositories.
Each chunk below should be a separate pull request unless its repository and
test setup make combining adjacent chunks safer.

### 1. Verify Old Player Identity and Refresh Contracts

**Scope**

- Trace the initial request, old player authentication, and player lookup.
- Capture the headers and cookies on the first production request for every
  supported wrapper version.
- Determine whether the first request has a server-verifiable identity.
- Trace Dooh's existing player update and refresh command.
- Determine whether that command remains connected while the adapter runs.
- Document Android and Electron wrapper versions, reload behaviour, and TLS
  constraints.

**Acceptance**

- The exact point at which a player row can be trusted is documented.
- The design chooses direct request routing or authenticated bootstrap routing.
- Refresh and rollback paths are proven for both flag transitions.

### 2. Add the Old Castmill Migration Field

**Scope**

- Add a non-null `migrated` boolean with a database default of `false`.
- Expose it only through authorized old player and Dooh APIs.
- Add model, migration, serialization, and authorization tests.
- Add audit data using the old system's established pattern.

**Dependencies**

- Verified old player identity contract.

**Acceptance**

- Existing player rows remain non-migrated.
- Unauthorized callers cannot read or change migration state.

### 3. Add the Dooh Checkbox and Delayed Refresh

**Scope**

- Add the checkbox to the player editor.
- Persist the flag before scheduling refresh.
- Use a configurable five-second default delay.
- Display update and refresh failures separately and allow refresh retry.
- Add UI, API, authorization, and scheduling tests.

**Dependencies**

- Migration field.
- Verified refresh contract.

**Acceptance**

- Toggling either direction saves the intended state.
- Rapid toggles cancel stale scheduled refreshes.
- A failed refresh never silently reverses or corrupts the saved flag.

### 4. Add Old Server Routing and Adapter Proxy

**Scope**

- Select the old player by default.
- Route identified migrated players to `/legacy/`.
- Gate every `/legacy/` document request using trusted identity and current
  migration state.
- Reverse-proxy `/legacy/` to `https://castmill.net/legacy/`.
- Add prefix, redirect, header, timeout, cache, logging, and failure handling.
- Add a global migration kill switch.

**Dependencies**

- Migration field.
- Verified identity contract.
- Reachable adapter staging deployment.

**Acceptance**

- Non-migrated and unidentified requests run the unchanged old player.
- Migrated requests load all adapter assets through the proxy.
- Clearing the flag makes the next `/legacy/` document request return to `/`.
- Upstream and database failures fail closed to the old player.

### 5. Make and Deploy the Adapter

**Scope**

- Correct environment-variable documentation.
- Fix fetch-polyfill response semantics and add tests.
- Address verified native message security constraints.
- Add a reproducible, versioned production build.
- Deploy to `castmill.net/legacy` and `legacy.castmill.net`.
- Configure new Castmill API, WebSocket, asset, and media access.

**Dependencies**

- Verified wrapper contract.

**Acceptance**

- Adapter lint, tests, and production build pass.
- The adapter works at both deployment URLs and through the old server proxy.
- A previous adapter release can be restored independently.

### 6. Implement Rollback Refresh from Dooh

**Scope**

- Map old players to new devices by verified hardware identifier.
- Deliver refresh to new Castmill when changing `migrated` from true to false,
  or implement the selected alternative control path.
- Authenticate, audit, retry, and report refresh delivery.
- Handle devices that are offline or not yet registered in new Castmill.

**Dependencies**

- Dooh checkbox.
- Adapter deployment.
- Verified cross-system mapping and command API.

**Acceptance**

- Rollback takes effect without physical access when the migrated player is
  online.
- Offline rollback remains pending or retryable and takes effect after the
  documented recovery action.

### 7. End-to-End Hardware Pilot

**Scope**

- Test representative Android and Electron devices.
- Cover both migration directions, PIN registration, credential recovery,
  playback, downloads, commands, cache, network loss, restart, and reboot.
- Exercise proxy and adapter failures plus the global kill switch.
- Record dashboards, alerts, runbooks, and rollout gates.

**Dependencies**

- All migration-path components deployed to staging.

**Acceptance**

- Critical flows and both rollback paths pass on physical hardware.
- Operators can distinguish old server, proxy, adapter, new backend, and native
  wrapper failures.

### 8. Production Rollout and DNS Cutover

**Scope**

- Deploy old server and Dooh migration functionality.
- Enable internal or low-risk players first, then migrate individually.
- Pause automatically when rollout health thresholds fail.
- After all players and the retention period are complete, validate
  `legacy.castmill.net` host and certificate handling and change DNS.
- Retain and test the emergency DNS rollback.

**Dependencies**

- Successful hardware pilot and approved rollback runbook.

**Acceptance**

- Non-migrated players behave exactly as before.
- Every migrated player can be independently rolled back during migration.
- Final DNS cutover preserves the configured URL, TLS, native bridge, and new
  Castmill connectivity.
