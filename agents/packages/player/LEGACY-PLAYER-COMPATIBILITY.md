# Legacy Player Compatibility

## Scope

Legacy Android players run the legacy adapter in Crosswalk on Android 5.1. Treat them
as an old Chromium browser even when the device itself has a newer Android WebView.
The legacy adapter Vite build targets Chrome 38:

```ts
// packages/platforms/legacy-adapter-player/vite.config.ts
legacy({ targets: { chrome: '38' } });
```

Modern browser validation is not sufficient. Test affected changes on a connected
legacy Android player before considering them compatible.

## JavaScript Rules

### Use transpiled syntax, but do not assume browser APIs

The legacy adapter's Vite legacy plugin transpiles supported JavaScript syntax and
bundles configured ECMAScript polyfills. TypeScript compilation does **not** polyfill
Web Platform APIs.

| Category                                     | Guidance                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Language syntax and standard-library methods | Use the adapter's production build; do not rely on untranspiled syntax or methods outside its configured polyfills.                                                    |
| `ResizeObserver`                             | Not available in Crosswalk. Feature-detect it, then use a small fallback such as `window.resize` plus an initial `requestAnimationFrame` measurement.                  |
| Fetch, promises, maps, sets                  | Use the adapter's existing polyfill setup. Do not add per-component implementations.                                                                                   |
| DOM layout measurements                      | Measure after layout has settled. A first `onMount` measurement can occur before a flex layout receives its final dimensions.                                          |
| Browser-only APIs                            | Feature-detect APIs such as storage, media, observers, and permissions. Provide an explicit fallback or surface a supported error; never silently assume availability. |

Avoid adding a large polyfill merely for a narrow use case. For example, a
`ResizeObserver` polyfill may poll or use fragile mutation heuristics. Native
`ResizeObserver` plus a `window.resize` fallback is more reliable and keeps the
legacy bundle smaller.

## CSS and Layout Rules

### Do not use unsupported layout primitives

Avoid these for player rendering that must work on the legacy Android target:

| Feature                                            | Why                                                                                                        | Compatible approach                                                                                        |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CSS Grid (`display: grid`, `grid-template-*`)      | Not supported by the Crosswalk target. QR modules rendered as an empty-looking box.                        | SVG, flexbox, or explicit positioned elements.                                                             |
| `aspect-ratio`                                     | Not supported by the target.                                                                               | Give the parent deterministic dimensions, or use an SVG `viewBox` with `preserveAspectRatio`.              |
| Percentage-sized flex children without constraints | Crosswalk can resolve percentage heights differently from current Chrome and shrink siblings unexpectedly. | Set intended `flex-shrink`, `box-sizing`, and explicit child sizing. Test both empty and populated states. |

Flexbox is available, but use it conservatively:

- Set `flex-shrink: 0` for fixed-size cards or media that must not collapse.
- Give text a dedicated height band if it must auto-fit within a column.
- Check empty, short, and long content values because flex sizing changes when a
  sibling is hidden.
- Prefer `em` units for spacing, consistent with the repository standard.

### QR codes

Render QR codes as SVG rather than a CSS Grid:

```tsx
<svg
  viewBox={`0 0 ${gridSize} ${gridSize}`}
  preserveAspectRatio="xMidYMid meet"
  shape-rendering="crispEdges"
>
  <rect width={gridSize} height={gridSize} fill={backgroundColor} />
  {/* One rect per dark module */}
</svg>
```

`shape-rendering="crispEdges"` is required to prevent Chrome from antialiasing
adjacent module edges into thin visible seams.

Use template conditional styles (`$styles`) for state-dependent layouts, such as
hiding an empty QR caption and expanding the QR card. Ensure every component that
uses `$styles` preserves `json.$styles` in its `fromJSON` implementation; otherwise
the template data reaches the player but its conditional style is silently dropped.

## Text Auto-Fitting

Auto-fit text must compare the rendered text bounds with the available parent bounds:

1. Measure the text element with `getBoundingClientRect()`.
2. Measure its containing layout box, not an ancestor that is larger than the text's
   actual allocation.
3. Reduce font size until both text width and height fit.
4. Re-run once in `requestAnimationFrame` after mount.
5. On browsers without `ResizeObserver`, re-run on `window.resize`.

Do not use the fixed text container's own width as a proxy for text width; it remains
the same while its content overflows, causing clipping instead of font reduction.

## Build and Verify

`@castmill/device` bundles `@castmill/player`. After changing player source, rebuild
in this order before testing the legacy adapter:

```bash
yarn workspace @castmill/player build
yarn workspace @castmill/device build
yarn workspace @castmill/legacy-adapter-player build:server
```

The final command writes the adapter served by Phoenix to
`packages/castmill/priv/static/legacy/`. Rebuilding only `@castmill/player` leaves
the stale player implementation embedded in `@castmill/device/dist`.

The legacy adapter build also generates `/legacy/sw.js` from the final Vite
output. The worker precaches one complete, content-addressed adapter release and
activates it only after every required file is available. It controls both
`/legacy` and `/legacy/` without reloading the currently running page. Do not
maintain its hashed asset list manually.

Offline cold startup requires:

- an HTTPS adapter origin trusted by the legacy runtime;
- one successful online load to install the shell and populate content caches;
- the adapter shell and APIs to retain their origin; and
- proxies to preserve `Service-Worker-Allowed: /legacy` on `/legacy/sw.js`.

The shell worker does not replace the content caches. IndexedDB stores the
channel/playlist metadata, `StorageBrowser` stores browser resources, and legacy
Android uses `AndroidLegacyFileStorage` plus its persisted `FILE_MAP` for native
media. Validate all layers during an offline restart.

### Legacy Android content-cache recovery

The legacy Android cache treats IndexedDB and native files as independently
recoverable indexes:

- A malformed or structurally invalid `FILE_MAP` is reset to an empty map. The
  IndexedDB reconciliation then removes stale metadata so content can be
  downloaded again.
- Current Android wrappers expose `fileExists` through the iframe bridge.
  `AndroidLegacyFileStorage.listFiles()` removes mappings for native files that
  have disappeared. Older wrappers remain compatible but cannot perform this
  proactive check.
- If IndexedDB reports a database failure during initialization, the cache
  deletes and recreates that database. Native files without rebuilt metadata are
  treated as unreferenced and removed.
- Native `CacheFull` errors are translated to `NOT_ENOUGH_SPACE`, causing the
  cache to evict least-recently-used entries and retry. If no cached content can
  make enough room, media lookup returns no local URL instead of terminating the
  player loop.
- A full cache clear deletes every IndexedDB entry and the complete native
  storage path, including files orphaned by metadata corruption. It must reload
  the player afterward so it cannot retain deleted media or code URLs in memory.
- Reconciliation cleanup is best effort. A missing or concurrently deleted
  native file is logged but does not block player startup.

Deploy the matching `android-app` wrapper when relying on native existence
checks. Its storage bridge reserves 128 MB before each chunk, makes deletion
idempotent, and removes partial downloads after terminal failures.

With an Android player attached over ADB:

```bash
adb devices -l
adb shell am force-stop com.optimalbits
adb shell monkey -p com.optimalbits 1
adb logcat -d -v brief | grep -Ei 'JavaScript ERROR|Crosswalk'
adb shell screencap -p /sdcard/player.png
adb pull /sdcard/player.png /tmp/player.png
```

For DOM inspection, Crosswalk exposes Chrome DevTools through an abstract socket:

```bash
adb forward tcp:9222 localabstract:com.optimalbits_devtools_remote
curl http://127.0.0.1:9222/json
```

Validate visual changes using screenshots at the device's native display size. Check
both a populated QR caption and an empty caption, long auto-fit text, configured
foreground/background colors, and square QR scaling.
