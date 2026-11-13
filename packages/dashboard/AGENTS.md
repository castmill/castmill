# Dashboard Internationalization (i18n) - Agent Guide

This guide provides comprehensive information about internationalization in the Castmill Dashboard to help AI agents maintain proper i18n standards across all PRs.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Critical Rules](#critical-rules)
3. [i18n System Architecture](#i18n-system-architecture)
4. [Usage Patterns](#usage-patterns)
5. [Translation Workflow](#translation-workflow)
6. [Testing Requirements](#testing-requirements)
7. [Common Pitfalls](#common-pitfalls)
8. [Validation Tools](#validation-tools)
9. [URL-Based Routing & Organization Switching](#url-based-routing--organization-switching)
10. [Light and Dark Mode](#light-and-dark-mode)

---

## Overview

The Dashboard is **fully internationalized** with support for 9 languages. Every user-facing string must be localized. The system provides:

- **Text translation** with parameter interpolation
- **Pluralization** with locale-specific rules
- **Date/time formatting** with locale awareness
- **Number formatting** per locale conventions
- **Currency formatting** with proper symbols
- **RTL support** for Arabic

### Supported Languages

| Code | Language | Native Name | Coverage | RTL |
| ---- | -------- | ----------- | -------- | --- |
| `en` | English  | English     | 100%     | No  |
| `es` | Spanish  | Español     | 100%     | No  |
| `sv` | Swedish  | Svenska     | 100%     | No  |
| `de` | German   | Deutsch     | 100%     | No  |
| `fr` | French   | Français    | 100%     | No  |
| `zh` | Chinese  | 中文        | 100%     | No  |
| `ar` | Arabic   | العربية     | 100%     | Yes |
| `ko` | Korean   | 한국어      | 100%     | No  |
| `ja` | Japanese | 日本語      | 100%     | No  |

---

## Device Details Orientation

The device addon Details form supports clockwise `0`, `90`, `180`, and `270`
degrees. Translations live under `devices.orientation` in all nine locales.
Offline edits persist on the server and apply at the next player connection.
The device's `info.capabilities.orientation` flag must explicitly be true to
enable the selector; absent flags identify older players. When a player posts
`/devices/:id/info`, the backend forwards the new `info` through
`device:status`, so an upgraded player unlocks the selector without a reload.

Keep saved desired state distinct from application feedback. The device observer's
`device:status` payload can carry `orientation` or `orientation_status` without an
`online` property. Merge only present fields, ignore acknowledgements for a
different angle, and preserve unsaved form edits when status updates arrive.
Offline updates explicitly set `orientation_status` to `null` to clear stale
application or error reports. Preserve that null when merging partial updates,
and wait for a fresh report after reconnecting, even at the same angle.
Update parent state only after successful saves using the server response.
Match the Details form card styling for orientation. Keep its explanatory text
in a hover/focus tooltip; omit successful application text while retaining
pending, offline, unsupported-player, and error feedback.
Registration and diagnostics are not part of the playback rotation subtree.

## Playlist Editor Drawer

The widget picker uses `PlaylistsService.getWidgets` to load every available
widget page (100 per request), including every page of search results. Do not
rely on the organization widgets API's default page size of 10 or treat its
first page as the full catalogue. The same list serves wide and narrow pickers.

Playlist preview duration priming must only render items without an explicit
positive duration. Fixed-duration items already have correct timeline offsets;
rendering them again offscreen duplicates expensive widgets during editor startup.
Yield between background measurements and cancel them when the preview changes
or unmounts. Wait for `Renderer.show` readiness, never for a duration to differ
from the 10-second fallback: 10 seconds is also a valid final duration, and a
non-default value does not imply readiness. Failed or timed-out measurements
must be logged and must not publish guessed offsets as successfully measured.

`addons/playlists/components/playlist-view.tsx` follows the Device Details
drawer design: a summary bar, sticky section tabs and dark cards.
`useWideLayout` (ui-common) with `WIDE_LAYOUT_QUERY` (64em) chooses the layout,
but only if its ResizeObserver also measures the editor at `WIDE_LAYOUT_MIN_EM`
(57em) or more. This keeps tablets with an enlarged layout viewport on tabs. Wide screens
show Widgets | Items | Preview side by side, with Content and Settings tabs.
Narrow screens use Content, Preview and Settings tabs, and "Add widget" opens a
tap-to-add widget picker. While it's open (`.playlist-view.picking`), the
picker fills the drawer body so only its list scrolls; below 32em of height,
only the drawer body scrolls. Every add (drop, `+` or tap) goes through the
function `PlaylistItems` registers with `onAddWidgetReady`, which keeps
credential checks and the config modal in one place. On narrow or
coarse-pointer layouts each item gets an up/down reorder stepper on its
leading edge instead of the drag grip. It uses the same index
semantics as drag-and-drop, then highlights the moved item and scrolls it into
view. Drag-and-drop and the grip are disabled on coarse pointers.
In the narrow layout (`tapToEdit`), tapping a row opens its config, because the
preview isn't visible there; wide layouts seek the preview instead. If the
config for a picked widget is cancelled, the picker stays open. Removing an
item asks for confirmation.
Settings is a single full-width card with no Save or Reset buttons: name,
aspect ratio (with its hint) and a created/updated footer. The name (`PlaylistNameField`)
saves on blur or Enter. Escape, or leaving with an invalid name, reverts it.
Custom ratios save when focus leaves the width/height pair or on Enter. Renames
call `onChange` so the drawer title and table refresh. Toggle the editor cards with `is-hidden` instead of
unmounting them, so the preview player is mounted only once, and don't add more
ResizeObservers to the view (the preview fit tests rely on a single observer).

The widget config modal (`WidgetConfig`, opened with
`contentClass="widget-config-modal"`) uses the same card style. Above 56em, it
shows the form and preview cards side by side. Up to 56em, it stacks the preview
above a scrolling form. Up to 36em, it becomes a full-screen sheet with a
leading back arrow (`closeVariant="back"`) instead of ✕. The pinned footer has
Cancel plus one primary action. New items get "Add to playlist", which is
enabled while the form is valid. Existing items get "Save", which also requires
an edit. There is no Reset button. When the form is dirty, every dismissal
(✕/back, Escape, backdrop or Cancel) goes through the Modal `onCloseRequest`
guard and asks before discarding. Modal overrides target the CSS-module
classes with `[class*='modalHeader']`/`[class*='modalBody']` so the shared
ui-common Modal stays untouched. Form fields keep the default `FormItem`
palette, and the header, tabs and save bars match Device Details.

Shared mobile behaviour (ui-common):

- `Modal` accepts `closeLabel` (localized close/back tooltip and accessible
  name), `closeVariant` and `onCloseRequest` (return false to veto a user
  dismissal; `ref.close()` bypasses it). `ConfirmDialog` takes
  `confirmLabel`/`cancelLabel`/`closeLabel`; always pass localized labels.
- `Drawer` is always full screen below 50em. The panel has `max-width: 100%`,
  so `vw`-based widths can't push it past the pinned root on tablets. The `.drawerRoot .drawerPanel`
  rule beats any `contentClass` width.
- `Drawer` default/`size` widths use `:where()` (below class specificity), so a
  single-class `contentClass` width always wins. Addon bundles each inject their
  own copy of ui-common CSS on load, so never rely on stylesheet order.
- Size drawers only with the `size` prop (`sm | md | lg | xl`). Don't set
  width/height through `contentClass`; it fights the built-in sizing and the
  ≤50em full-screen mode. Put sticky Save/Reset actions in the Drawer `footer`.
- Details views share ui-common primitives: `DetailsSummary` (status pills,
  note, meta chips and a copy-ID button; `compact` gives the slim strip on
  phones and coarse pointers), `SectionCard`/`SectionCardHeader` (icon, title,
  count, description, header actions and a `footer` for Save/Reset), and the
  `useMediaQuery`/`useWideLayout` hooks (media query plus a container
  ResizeObserver). Pass localized labels; the primitives contain no strings.
- `ComboBox` opens a bottom sheet (Portal, `[data-combobox-sheet]`) when
  `COMBOBOX_SHEET_QUERY` matches (phones and touch tablets). Otherwise it flips
  upward when there is no room below. Pass `closeLabel={t('common.close')}`.
- The Modal overlay, Drawer root and ComboBox sheet backdrop use
  `useVisualViewportBox()` to pin themselves to `window.visualViewport`. When
  the page overflows horizontally, mobile browsers enlarge the layout viewport
  and plain `position: fixed; inset: 0` layers end up off-screen. Size
  full-screen modal content with `100%` of the overlay (and
  `box-sizing: border-box`), not `100vw`/`100dvh`.
  Drawers ignore outside clicks inside the sheet.
- `Tabs` is an ARIA tablist (Arrow keys mirrored in RTL, Home/End) whose rail
  scrolls horizontally instead of squeezing labels; the active tab is scrolled
  into view and hidden edges fade. Give each `TabItem` an `icon` so inactive
  tabs collapse to icon-only at ≤36em (the title stays as tooltip and
  accessible name), and pass `ariaLabel={t('common.sections')}`.

## Channel Details Drawer

The channel schedule (`src/pages/channels-page/calendar-view.tsx`) has three
layouts, exposed as `data-layout` on the calendar root:

- `wide` (`WIDE_CALENDAR_QUERY`, ≥64em, fine pointer, calendar ≥50em wide):
  week grid with the `PlaylistChooser` side panel; drag playlists onto slots
  and drag/resize entries.
- `narrow` (tablets and touch devices): full-width week grid; the chooser is a
  collapsible horizontal strip (`variant="strip"`) above the calendar.
- `day` (`DAY_VIEW_QUERY`, ≤40em): a single day with previous/next day buttons
  and horizontal swipe paging (mirrored in RTL). Paging past Monday/Sunday
  changes the week, so `onWeekChange` still fires.

On touch layouts tapping a free slot opens `CalendarAddEntry` (duration select
and playlist `ComboBox` bottom sheet). Placement uses the same overlap and
end-of-week checks as drag and drop (`isValidPlacement`). Entry boxes and
automation markers are clipped to the visible days, and they are measured from
the cell refs, so keep cells registered synchronously and use the outer edges
of the first and last day cells (days run right-to-left in RTL). Calendar
height is relative to the viewport (`clamp(20em, 60dvh, 50em)`); never style
`html`/`body` from the calendar styles.

## Layout Editor

- `LayoutEditor` (`addons/common/components/layout-editor`) is shared by the
  Layouts drawer and the playlist widget config. It measures its own width
  with a ResizeObserver and adds `layout-editor--stacked` below
  `STACKED_MAX_WIDTH_EM` (48em): properties and the zone list move below the
  canvas. Never switch this on the viewport; embeds can be narrow on desktop.
- Zone move/resize uses Pointer Events (mouse, pen and touch) with
  `touch-action: none` on zones and handles; only the primary pointer drives
  a drag and `pointercancel` ends it. Handles grow on `(pointer: coarse)`.
- The canvas is `dir="ltr"`: zone rects are physical screen geometry, also in
  Arabic. Pass `t` to the editor; its strings live under `layouts.editor.*`.
- The Layouts drawer portals its Save bar into the Drawer `footer`
  (`LayoutView` `actionsMount`), like media details.

## Team Details Drawer

`pages/teams-page/team-view.tsx` owns its `Drawer` so the form state and the
Save/Reset footer stay together. The footer's submit button targets the form
through the `form` attribute. Keep the members/invitations tabs outside that
form; otherwise pressing Enter in a table search field submits the team.
Existing teams show a compact `DetailsSummary` with the name, member count
(reloaded when a member is removed), and localized created/updated times.
Teams from the API use `inserted_at`/`updated_at`. The nested tables use
`cardLayout`; pass `locale={locale()}` to `Timestamp` cells.

## Modals and Forms

The ui-common `Modal` becomes a bottom sheet under `36em`, with the body as
its only scroll container. Put `data-modal-actions` on a modal form's button
row so it sticks to the bottom with full-width buttons on phones. Let form
rows wrap to a single column at `(max-width: 36em)`, and size modals with
`contentClass` in `em` (no `!important` or `vw` overrides).

## Critical Rules

### ⚠️ MANDATORY: All User-Facing Text Must Be Localized

**❌ NEVER do this:**

```tsx
<button>Save</button>
<h1>Settings</h1>
<p>Loading...</p>
```

**✅ ALWAYS do this:**

```tsx
const { t } = useI18n();

<button>{t('common.save')}</button>
<h1>{t('settings.title')}</h1>
<p>{t('common.loading')}</p>
```

### ⚠️ MANDATORY: Add Translations to ALL Languages

When adding a new translation key:

1. **Add to English first** (`locales/en.json`) - this is the reference
2. **Add to all 8 other languages** - never leave a language incomplete
3. **Use proper translations** - don't just copy English to other languages
4. **Run validation** - use `yarn check-translations` before committing

### ⚠️ MANDATORY: Use Proper i18n Functions

Choose the right function for the job:

| Use Case         | Function                   | Example                          |
| ---------------- | -------------------------- | -------------------------------- |
| Simple text      | `t(key)`                   | `t('common.save')`               |
| Text with params | `t(key, params)`           | `t('welcome', { name: 'John' })` |
| Plurals          | `tp(key, count)`           | `tp('plurals.items', 5)`         |
| Dates            | `formatDate(date)`         | `formatDate(new Date())`         |
| Numbers          | `formatNumber(num)`        | `formatNumber(1234.56)`          |
| Currency         | `formatCurrency(val, cur)` | `formatCurrency(99.99, 'USD')`   |

---

## i18n System Architecture

### File Structure

```
packages/dashboard/src/i18n/
├── i18n-context.tsx          # Main provider and hooks
├── types.ts                  # TypeScript types and locale mappings
├── index.ts                  # Public exports
├── README.md                 # Detailed documentation
├── i18n-context.test.tsx     # Comprehensive tests
└── locales/                  # Translation files
    ├── en.json              # English (reference)
    ├── es.json              # Spanish
    ├── sv.json              # Swedish
    ├── de.json              # German
    ├── fr.json              # French
    ├── zh.json              # Chinese
    ├── ar.json              # Arabic (RTL)
    ├── ko.json              # Korean
    └── ja.json              # Japanese
```

### Core Components

#### 1. I18nProvider

Wraps the entire application and provides i18n context.

```tsx
// In src/index.tsx
<I18nProvider>
  <App />
</I18nProvider>
```

#### 2. useI18n Hook

Primary interface for accessing i18n functions.

```tsx
import { useI18n } from '../../i18n';

const {
  locale, // Current locale (Accessor<Locale>)
  setLocale, // Change language
  t, // Translate text
  tp, // Translate with pluralization
  formatDate, // Format dates
  formatNumber, // Format numbers
  formatCurrency, // Format currency
  translations, // Raw translations object
} = useI18n();
```

#### 3. Language Selector

UI component for switching languages.

```tsx
import LanguageSelector from '../../components/language-selector/language-selector';

<LanguageSelector />;
```

---

## Usage Patterns

### 1. Basic Translation

```tsx
import { useI18n } from '../../i18n';

function MyComponent() {
  const { t } = useI18n();

  return (
    <div>
      <h1>{t('myComponent.title')}</h1>
      <button>{t('common.save')}</button>
    </div>
  );
}
```

**Translation file (en.json):**

```json
{
  "myComponent": {
    "title": "My Component"
  },
  "common": {
    "save": "Save"
  }
}
```

### 2. Translation with Parameters

```tsx
const { t } = useI18n();
const userName = 'Alice';

<p>{t('greeting.hello', { name: userName })}</p>;
// Output: "Hello, Alice!"
```

**Translation file:**

```json
{
  "greeting": {
    "hello": "Hello, {{name}}!"
  }
}
```

### 3. Pluralization

```tsx
const { tp } = useI18n();
const itemCount = 5;

<p>{tp('plurals.items', itemCount)}</p>;
// English: "5 items"
// German: "5 Artikel"
```

**Translation file:**

```json
{
  "plurals": {
    "items": {
      "one": "{{count}} item",
      "other": "{{count}} items"
    }
  }
}
```

### 4. Date Formatting

```tsx
const { formatDate } = useI18n();

<p>{formatDate(new Date('2024-01-15'))}</p>
// English: "January 15, 2024"
// Spanish: "15 de enero de 2024"

<p>{formatDate(new Date(), 'PP')}</p>
// Short format: "Jan 15, 2024"
```

### 5. Number Formatting

```tsx
const { formatNumber } = useI18n();

<p>{formatNumber(1234.56)}</p>
// English: "1,234.56"
// German: "1.234,56"

<p>{formatNumber(0.85, { style: 'percent' })}</p>
// Output: "85%"
```

### 6. Currency Formatting

```tsx
const { formatCurrency } = useI18n();

<p>{formatCurrency(99.99, 'USD')}</p>
// English: "$99.99"
// Spanish: "99,99 US$"

<p>{formatCurrency(1234.56, 'EUR')}</p>
// English: "€1,234.56"
// German: "1.234,56 €"
```

---

## Translation Workflow

### Adding New Features with i18n

When adding a new component or feature:

1. **Identify all user-facing text**
   - Buttons, labels, headings, messages
   - Error messages, tooltips, placeholders
   - Table headers, form labels

2. **Add keys to English first**

   ```json
   // locales/en.json
   {
     "myFeature": {
       "title": "My Feature",
       "description": "This is my feature",
       "actions": {
         "submit": "Submit",
         "cancel": "Cancel"
       }
     }
   }
   ```

3. **Add translations to all languages**
   - Spanish, Swedish, German, French, Chinese, Arabic, Korean, Japanese
   - Use proper translations (not just English)
   - Maintain the same JSON structure

4. **Use translations in component**

   ```tsx
   const { t } = useI18n();

   <div>
     <h1>{t('myFeature.title')}</h1>
     <p>{t('myFeature.description')}</p>
     <button>{t('myFeature.actions.submit')}</button>
   </div>;
   ```

5. **Validate before committing**
   ```bash
   yarn check-translations
   ```

### Translation File Organization

Organize translations by feature/page:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  },
  "topbar": {
    "help": "Help",
    "profile": "Profile"
  },
  "settings": {
    "title": "Settings",
    "profile": "Profile Information"
  },
  "plurals": {
    "items": {
      "one": "{{count}} item",
      "other": "{{count}} items"
    }
  }
}
```

---

## Testing Requirements

### 1. Component Tests with i18n

All component tests must wrap components in `I18nProvider`:

```tsx
import { render, screen } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import MyComponent from './my-component';

describe('MyComponent', () => {
  it('renders with translations', () => {
    render(() => (
      <I18nProvider>
        <MyComponent />
      </I18nProvider>
    ));

    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
```

### 2. Testing Language Switching

```tsx
it('switches language correctly', async () => {
  function TestComponent() {
    const { locale, setLocale, t } = useI18n();

    return (
      <div>
        <button onClick={() => setLocale('es')}>Switch to Spanish</button>
        <p data-testid="translation">{t('common.save')}</p>
      </div>
    );
  }

  render(() => (
    <I18nProvider>
      <TestComponent />
    </I18nProvider>
  ));

  // Initially English
  expect(screen.getByTestId('translation').textContent).toBe('Save');

  // Switch to Spanish
  fireEvent.click(screen.getByText('Switch to Spanish'));
  await waitFor(() => {
    expect(screen.getByTestId('translation').textContent).toBe('Guardar');
  });
});
```

### 3. i18n Function Tests

Test all i18n functions:

```tsx
it('formats plurals correctly', () => {
  function TestComponent() {
    const { tp } = useI18n();
    return (
      <div>
        <p data-testid="one">{tp('plurals.items', 1)}</p>
        <p data-testid="many">{tp('plurals.items', 5)}</p>
      </div>
    );
  }

  render(() => (
    <I18nProvider>
      <TestComponent />
    </I18nProvider>
  ));

  expect(screen.getByTestId('one').textContent).toBe('1 item');
  expect(screen.getByTestId('many').textContent).toBe('5 items');
});
```

---

## Common Pitfalls

### ❌ Pitfall 1: Hardcoded Strings

```tsx
// WRONG
<button>Save Changes</button>;

// CORRECT
const { t } = useI18n();
<button>{t('common.saveChanges')}</button>;
```

### ❌ Pitfall 2: Missing Translations in Some Languages

```bash
# This will fail CI
# Only adding to English:
locales/en.json: "newFeature.title": "New Feature"

# MUST add to all languages:
locales/es.json: "newFeature.title": "Nueva Función"
locales/de.json: "newFeature.title": "Neue Funktion"
# ... and 6 more
```

### ❌ Pitfall 3: Not Using Pluralization

```tsx
// WRONG - doesn't handle singular/plural
<p>{count} items</p>;

// CORRECT - uses locale-specific plural rules
const { tp } = useI18n();
<p>{tp('plurals.items', count)}</p>;
```

### ❌ Pitfall 4: Manual Date/Number Formatting

```tsx
// WRONG - not locale-aware
<p>{date.toLocaleDateString()}</p>
<p>${price.toFixed(2)}</p>

// CORRECT - uses proper locale formatting
const { formatDate, formatCurrency } = useI18n();
<p>{formatDate(date)}</p>
<p>{formatCurrency(price, 'USD')}</p>
```

### ❌ Pitfall 5: Forgetting i18n in Tests

```tsx
// WRONG - component will crash
render(() => <MyComponent />);

// CORRECT - wrap in I18nProvider
render(() => (
  <I18nProvider>
    <MyComponent />
  </I18nProvider>
));
```

---

## Validation Tools

### 1. Translation Coverage Check

**Script**: `scripts/check-missing-translations.cjs`

```bash
# Check all languages
yarn check-translations

# Check specific language
yarn check-translations es
yarn check-translations de
```

This script:

- Compares all languages against English reference
- Identifies missing keys
- Detects untranslated strings (same as English)
- Fails CI if translations are incomplete

### 2. Local Validation

Before committing:

```bash
# 1. Check translations
cd packages/dashboard
yarn check-translations

# 2. Run tests
yarn test

# 3. Build
yarn build
```

### 3. CI/CD Validation

GitHub Actions automatically:

- Runs translation coverage check on every PR
- Fails if any language is incomplete
- Posts detailed report as PR comment
- Shows coverage in workflow summary

**Workflow**: `.github/workflows/check-translations.yml`

### 4. Understanding the Coverage Report

```
Language    Coverage    Missing    Untranslated    Status
----------------------------------------------------------
ES          100%        0          0               ✓ Complete
SV          97.6%       0          7               ⚠ Incomplete
```

- **Coverage**: Percentage of translated keys
- **Missing**: Keys that don't exist in the file
- **Untranslated**: Keys with same value as English
- **Status**: ✓ Complete or ⚠ Incomplete

---

## Quick Reference

### When Adding New Code

1. **Check**: Does it have user-facing text? → Use i18n
2. **Add**: Translation keys to `locales/en.json`
3. **Translate**: Add to all 8 other language files
4. **Use**: `const { t } = useI18n()` and `t('key')`
5. **Test**: Wrap test components in `I18nProvider`
6. **Validate**: Run `yarn check-translations`

### i18n Hook Functions

```tsx
const {
  locale, // Current language code
  setLocale, // Change language
  t, // Translate text
  tp, // Translate with plurals
  formatDate, // Format dates
  formatNumber, // Format numbers
  formatCurrency, // Format currency
  translations, // Raw translations
} = useI18n();
```

### Common Translation Keys

Already defined in all languages:

- `common.save`, `common.cancel`, `common.delete`
- `common.edit`, `common.add`, `common.remove`
- `common.close`, `common.confirm`, `common.back`
- `common.search`, `common.loading`, `common.error`
- `topbar.help`, `topbar.notifications`
- `settings.*`, `usage.*`, `teams.*`
- `plurals.items`, `plurals.users`, `plurals.devices`

### File Locations

- **i18n implementation**: `src/i18n/`
- **Translation files**: `src/i18n/locales/`
- **Language selector**: `src/components/language-selector/`
- **Validation script**: `scripts/check-missing-translations.cjs`
- **Documentation**: `src/i18n/README.md`
- **This guide**: `AGENTS.md` (you are here)

---

## Additional Resources

- **Detailed API docs**: `src/i18n/README.md`
- **Root AGENTS.md**: `../../AGENTS.md` (i18n section)
- **date-fns formats**: https://date-fns.org/docs/format
- **Intl API**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl

---

## Maintaining i18n Standards

### For Every PR

1. ✅ All user-facing text uses `t()` or other i18n functions
2. ✅ New translation keys added to ALL 9 languages
3. ✅ Tests wrapped in `I18nProvider`
4. ✅ `yarn check-translations` passes locally
5. ✅ CI translation check passes

### Red Flags to Watch For

🚩 Hardcoded strings in JSX: `<button>Click me</button>`  
🚩 Missing from some languages: Only in `en.json`  
🚩 Copy-paste translations: Same text in all languages  
🚩 Test failures: "useI18n must be used within an I18nProvider"  
🚩 CI failures: "Translation check failed: X strings are untranslated"

### Success Criteria

✅ All text localized  
✅ All languages 100% complete  
✅ All tests passing  
✅ CI checks passing  
✅ Proper i18n functions used

---

**Remember**: Internationalization is not optional. Every user-facing string must be localized for all 9 supported languages. The translation coverage check in CI will enforce this standard.

---

## URL-Based Routing & Organization Switching

### Architecture Overview

The Dashboard uses **URL-based routing** with organization context to ensure:

- Organization selection persists across page refreshes
- Deep linking works correctly
- Browser back/forward buttons work as expected
- Data reloads properly when switching organizations

### URL Pattern

All authenticated routes include the organization ID:

```
/org/:orgId/path
```

**Examples:**

- `/org/abc-123/teams`
- `/org/abc-123/content/playlists`
- `/org/xyz-789/usage`

### Critical Implementation Details

#### 1. Route Structure

Routes are defined with organization ID as a parameter:

```tsx
<Route path="/org/:orgId" component={...}>
  <Route path="/teams" component={TeamsPage} />
  <Route path="/channels" component={ChannelsPage} />
  {/* Addon routes */}
  <Route path="/content/playlists" component={PlaylistsAddon} />
</Route>
```

#### 2. ProtectedRoute Synchronization

The `ProtectedRoute` component syncs URL params to the global store:

```tsx
// In protected-route.tsx
createEffect(() => {
  const urlOrgId = params.orgId;
  if (
    store.organizations.loaded &&
    urlOrgId &&
    urlOrgId !== store.organizations.selectedId
  ) {
    const org = store.organizations.data.find((o) => o.id === urlOrgId);
    if (org) {
      setStore('organizations', {
        selectedId: org.id,
        selectedName: org.name,
      });
    }
  }
});
```

#### 3. Navigation with Organization Context

All navigation must include the organization ID:

```tsx
// ✅ Correct - includes org ID
navigate(`/org/${store.organizations.selectedId}/teams`);

// ❌ Wrong - missing org ID
navigate('/teams');
```

**Sidebar navigation example:**

```tsx
<PanelItem
  to={`/org/${store.organizations.selectedId}/teams`}
  label={t('sidebar.teams')}
/>
```

**Organization dropdown:**

```tsx
const handleOrgChange = (value: string) => {
  const currentPath = location.pathname.replace(/^\/org\/[^\/]+/, '');
  navigate(`/org/${value}${currentPath || '/'}`);
};
```

#### 4. Addon Component Remounting

**CRITICAL:** Addon components must remount when organization changes.

**Problem:** SolidJS Router doesn't remount components when route params change. Going from `/org/abc/content/playlists` to `/org/xyz/content/playlists` keeps the same component instance.

**Solution:** Use `Show` with `keyed` attribute to force remounting:

```tsx
// In index.tsx - addon route wrapper
const KeyedComponent = (props: any) => {
  const params = useParams();
  return (
    <Show when={params.orgId} keyed>
      {(orgId) => {
        const Component = wrapLazyComponent(addon);
        return <Component {...props} key={orgId} />;
      }}
    </Show>
  );
};

<Route path={addon.mount_path} component={KeyedComponent} />;
```

This ensures:

- Old component instance is **unmounted** when orgId changes
- New component instance is **mounted** with fresh data
- `onMount()` runs again, loading data for the new organization

#### 5. Data Reloading Patterns

**Dashboard Core Pages** (Teams, Channels, Usage):

```tsx
import { store } from '../../store/store';

createEffect(
  on(
    () => store.organizations.selectedId,
    (orgId, prevOrgId) => {
      if (prevOrgId && orgId !== prevOrgId) {
        // Reload data for new organization
        loadData();
        if (tableViewRef) {
          tableViewRef.reloadData();
        }
      }
    }
  )
);
```

**Addon Components** (Playlists, Medias, Devices):

Since addons remount on org change, they just need `onMount()`:

```tsx
onMount(() => {
  loadQuota();
  // Data loads automatically on mount
});
```

The `createEffect` pattern is still included as a fallback, but the `keyed Show` wrapper handles most cases.

### Store Structure for Addons

Addon components receive the store via props with i18n functions attached:

```typescript
// In store/store.tsx
interface CastmillStore {
  organizations: {
    loaded: boolean;
    loading: boolean;
    data: Organization[];
    selectedId: string | null;
    selectedName: string;
  };
  // ... other fields
  i18n?: {
    t: (key: string, params?: Record<string, any>) => string;
    tp: (key: string, count: number, params?: Record<string, any>) => string;
    formatDate: (date: Date, format?: string) => string;
    // ... other i18n functions
  };
}
```

The i18n functions are set using `setStore()` in the addon wrapper:

```tsx
// In index.tsx - wrapLazyComponent
setStore('i18n', {
  t: i18n.t,
  tp: i18n.tp,
  formatDate: i18n.formatDate,
  // ... other i18n functions
});
```

### Common Pitfalls

❌ **Hardcoding organization ID**

```tsx
const orgId = 'abc-123'; // Wrong!
```

✅ **Using store or params**

```tsx
const orgId = store.organizations.selectedId;
// or
const params = useParams();
const orgId = params.orgId;
```

❌ **Navigation without org ID**

```tsx
navigate('/teams'); // Wrong - will break routing
```

✅ **Including org ID in all navigation**

```tsx
navigate(`/org/${store.organizations.selectedId}/teams`);
```

❌ **Assuming components remount on param change**

```tsx
// This won't reload when orgId changes without keyed Show
<Route path="/addon" component={AddonComponent} />
```

✅ **Using keyed Show for addons**

```tsx
<Show when={params.orgId} keyed>
  {(orgId) => <AddonComponent key={orgId} />}
</Show>
```

### Testing Organization Switching

When testing organization-related features:

1. ✅ Verify URL changes when switching organizations
2. ✅ Check that data reloads for the new organization
3. ✅ Confirm page refresh maintains selected organization
4. ✅ Test browser back/forward buttons work correctly
5. ✅ Ensure deep links work (e.g., sharing a URL to a specific org's page)

### Debugging Checklist

If organization switching isn't working:

- [ ] Check URL contains `/org/:orgId/` pattern
- [ ] Verify `ProtectedRoute` has `createEffect` that syncs params to store
- [ ] Confirm all navigation includes organization ID
- [ ] For addons: Check route uses `Show` with `keyed` wrapper
- [ ] Verify `store.organizations.selectedId` updates when URL changes
- [ ] Check component `onMount` or `createEffect` is loading data
- [ ] Look for "Cannot mutate a Store directly" warnings (use `setStore`)

---

---

## Light and Dark Mode

The dashboard supports light and dark mode. **Every new view, dialog,
component, and addon must ship with both themes**; a dark-only (or light-only)
view is a bug.

### How it works

- `src/theme/theme.scss` defines the `--cm-*` design tokens for
  `:root[data-theme='dark']` (default) and `:root[data-theme='light']`, plus
  the switch animation.
- `src/theme/theme-context.tsx` (`ThemeProvider`, `useTheme`) sets
  `data-theme` on `<html>`, caches the choice in localStorage
  (`castmill_theme`) and saves it to the user's preferences
  (`GET/PUT /dashboard/users/:user_id/preferences`, stored in `users.meta`).
  Without a saved choice the OS `prefers-color-scheme` is used. The boot script
  in `index.html` applies the cached theme before first paint.
- `ThemeToggle` (topbar) switches themes. The switch cross-fades with the View
  Transitions API, falls back to short CSS colour transitions, and skips the
  animation when the user prefers reduced motion.
- Addons receive the theme as `props.store.theme` but should style with tokens.

### Logos and branding

Images such as logos cannot be recoloured with tokens, so they need a variant
per theme. The topbar picks its logo with `resolveNetworkLogo`
(`src/theme/network-logo.ts`):

| Network configuration     | Dark theme              | Light theme                                 |
| ------------------------- | ----------------------- | ------------------------------------------- |
| No logo                   | bundled Castmill (dark) | bundled Castmill (light)                    |
| `logo` only               | `logo`                  | `logo` on a dark backdrop (stays legible)   |
| `logo` and `logo_light`   | `logo`                  | `logo_light`                                |

Network admins set both URLs in Network Settings (also in the Phoenix admin
network form); `GET /dashboard/network/public-settings` returns them as `logo`
and `logo_light`, stored in `store.networkSettings.logo`/`logoLight`. Reuse
this resolver for any new place that shows the network logo.

### Token reference

| Purpose                 | Tokens                                                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Page / panels / cards   | `--cm-bg-app`, `--cm-bg-primary`, `--cm-bg-secondary`, `--cm-bg-tertiary`, `--cm-bg-sunken`                                    |
| Dialogs, menus, popover | `--cm-bg-elevated`, `--cm-bg-elevated-secondary`, `--cm-bg-overlay` (backdrop)                                                |
| Inputs                  | `--cm-bg-input`, `--cm-border-color`, `--cm-focus-ring`                                                                       |
| Interaction             | `--cm-bg-hover`, `--cm-bg-hover-strong`, `--cm-bg-active`, `--cm-bg-selected`                                                  |
| Text                    | `--cm-text-primary`, `--cm-text-secondary`, `--cm-text-tertiary`, `--cm-text-disabled`, `--cm-text-placeholder`, `--cm-text-inverse`, `--cm-text-on-primary` |
| Borders                 | `--cm-border-color`, `--cm-border-subtle`, `--cm-border-strong`                                                                |
| Accent                  | `--cm-primary`, `--cm-primary-hover`, `--cm-primary-active`, `--cm-primary-bg`, `--cm-link`, `--cm-primary-rgb`                |
| Status                  | `--cm-success`, `--cm-error`, `--cm-warning`, `--cm-info` (+ `-bg` and `-rgb` variants)                                        |
| Shadows                 | `--cm-shadow-sm`, `--cm-shadow-md`, `--cm-shadow-lg`, `--cm-shadow-color`                                                      |

### Rules for new UI

```scss
// ✅ Works in both themes
.card {
  background: var(--cm-bg-secondary);
  color: var(--cm-text-primary);
  border: 1px solid var(--cm-border-color);

  &:hover {
    background: var(--cm-bg-hover);
  }
}

// ❌ Dark-only
.card {
  background: #2c303b;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

- Translucent accents: `rgba(var(--cm-primary-rgb), 0.15)`.
- `colors.$...` SCSS variables are tokens; never pass them to Sass colour
  functions.
- Don't redefine `--cm-*` tokens in a component and don't use
  `@media (prefers-color-scheme)`.
- If no token fits, add a light override: `:root[data-theme='light'] .x {}`
  (CSS modules: `:global(:root[data-theme='light']) .x {}`).
- Inline styles use `'var(--cm-…)'`. Canvas/chart code reads `useTheme()`
  (dashboard), `props.store.theme` (addons), or the computed token value.
- Brand buttons with white text, status colours, and media previews may keep
  literal colours if they read well on both backgrounds.
- Before submitting, check every new view, dialog, and state (empty, loading,
  error, hover, selected, disabled) in both themes with the topbar toggle.
