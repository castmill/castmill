# Responsive Dashboard

How the dashboard, ui-common components and dashboard addons adapt to phones,
tablets and desktops, and how that is tested. Package-level details live in
`packages/dashboard/AGENTS.md` ("Responsive App Shell", "Responsive
Conventions") and `agents/packages/ui-common/README.md`.

## Target sizes

| Size        | Viewport                     | Shell                                  |
| ----------- | ---------------------------- | -------------------------------------- |
| Phone       | 375×812                      | Off-canvas nav drawer, compact top bar |
| Tablet      | 768×1024 (portrait)          | Off-canvas nav drawer, compact top bar |
| Tablet      | 1024×768 (landscape)         | Icon rail, full top bar + menu button  |
| Desktop     | 1440×900                     | Static side panel                      |

## Breakpoints

All media and container queries use `em`, so they follow the user's font size.

| Query                        | Used for                                                     |
| ---------------------------- | ------------------------------------------------------------ |
| `(max-width: 36em)`          | Phone: modal bottom sheet, single-column forms, list toolbars |
| `(max-width: 48em)`          | Off-canvas nav and compact top bar (`NAV_OFFCANVAS_QUERY`)   |
| `(max-width: 50em)`          | ui-common `Drawer` goes full screen                          |
| `(max-width: 64em)`          | Icon-rail nav (`NAV_COLLAPSED_QUERY`)                        |
| `(hover: none), (pointer: coarse)` | Touch: hide keyboard-shortcut UI, ComboBox sheet       |

Components that are embedded in other surfaces (for example the shared
`LayoutEditor` inside the playlist widget config) size themselves with a
`ResizeObserver`/container query on their own width instead of the viewport.

## Units

- Spacing, sizes, radii, shadows and font sizes use `em` (or `rem` for values
  that must not scale with a local font size, such as the top bar height).
- `1px` hairlines (borders, dividers, focus outlines) may stay in `px`.
- Pills use `border-radius: 999em`.
- Inputs that must not trigger iOS zoom on focus use
  `font-size: max(1rem, 1em)`.

## Safe areas and the on-screen keyboard

- `index.html` sets `viewport-fit=cover` so content can extend under the iOS
  notch and home indicator, and `interactive-widget=resizes-content` so
  Chromium shrinks the layout viewport when the keyboard opens.
- Fixed or edge-to-edge surfaces pad themselves with
  `env(safe-area-inset-*, 0)`: top bar (top), footer (bottom), `#root`
  (left/right), off-canvas side panel, ui-common `Drawer` panel, `Modal` and
  `ComboBox` bottom sheets, toasts, the selection action bar and the
  notification dialog.
- `Modal`, `Drawer` and the `ComboBox` sheet pin their overlay to the visual
  viewport (`useVisualViewportBox`), so the keyboard shrinks them instead of
  covering inputs.
- iOS Safari does not resize the layout viewport for the keyboard.
  `trackKeyboardInset()` (ui-common, started once in
  `packages/dashboard/src/index.tsx`) publishes the keyboard height as
  `--cm-keyboard-inset` on `<html>` and sets `data-keyboard-open` while it is
  visible. Bottom-anchored fixed bars use
  `bottom: var(--cm-keyboard-inset, 0em)`. Components that need the value in
  JS use `useKeyboardInset()`.

## Installability

`packages/dashboard/public/manifest.webmanifest` makes the dashboard
installable (standalone display, Castmill icons in `public/icons/`, including a
maskable icon and an `apple-touch-icon`). `<meta name="theme-color">` follows
the active theme: the boot script in `index.html` sets it before first paint
and `syncThemeColor()` in `src/theme/theme-context.tsx` keeps it in sync with
the light/dark toggle.

## Responsive end-to-end checks

`packages/dashboard/e2e/` holds Playwright checks that run in CI
(`test_dashboard_responsive` in `.github/workflows/test.yml`).

- Projects in `playwright.config.ts`: `phone`, `tablet-portrait`,
  `tablet-landscape`, `desktop` (the sizes above).
- The backend is mocked in `e2e/fixtures.ts` (`page.route` on
  `http://localhost:4000`), so only the Vite dev server runs. No addons are
  loaded; the checks cover the core pages, shell and drawers.
- Each core page is checked in light and dark theme, and selected pages in
  Arabic (RTL). Every check asserts that the page never scrolls horizontally
  (`expectNoHorizontalOverflow`) and attaches a screenshot to the report.
- Navigation drawer, channel details drawer, login/sign-up, viewport meta and
  manifest/icons have dedicated checks.

```bash
yarn workspace @castmill/ui-common build
cd packages/dashboard
npx playwright install chromium   # or PLAYWRIGHT_CHROMIUM_CHANNEL=chrome
yarn e2e                          # yarn e2e --project=phone
```

When adding a core page, add it to `PAGES` in `e2e/responsive.spec.ts` and
mock its endpoints in `e2e/fixtures.ts`.
