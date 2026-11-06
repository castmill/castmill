# Generic Template Widget

This widget is a generic template widget that can be used to create new widgets. It is divided into two parts:
a **data model** and a **view**. The data model defines how the data is supposed to arrive at the widget, and the
view takes care of rendering the data.

The widget supports several smart components that can be used to create resolution-independent widgets.

## Data Model

### Formatting

Integrations deliver raw values (numbers, ISO 8601 dates, arrays of objects). Templates format them with the
`fmt`, `list` and `first` bindings below; the formatters live in `format/`. See
`agents/systems/TEMPLATE-VALUE-FORMATTING.md` for the design.

## Bindings

Bindings allow templates to dynamically resolve values from configuration, data, or context. The template system
supports several binding types that enable flexible, data-driven widget configurations.

### Simple Binding

The basic binding resolves a value from a key path. The key can reference `options.*`, `data.*`, or context values (`$.*`).

```json
{
  "key": "options.title",
  "default": "Default Title"
}
```

**Key Path Prefixes:**

- `options.*` - Static configuration values
- `data.*` - Dynamic data from APIs/webhooks
- `$.*` - Current iteration context (used within lists)

### Switch Binding

Selects a value based on matching a key against predefined cases. Similar to a switch statement in programming.

```json
{
  "switch": {
    "key": "$.direction",
    "cases": {
      "up": "#00C853",
      "down": "#FF1744",
      "default": "#9E9E9E"
    }
  }
}
```

**Use Cases:**

- Map status codes to colors
- Select icons based on category
- Choose layouts based on data type

### Conditional Binding

Selects a value based on numeric comparisons. Supports `gte`, `gt`, `lte`, `lt`, `eq`, and `neq` operators.

```json
{
  "cond": {
    "key": "$.change",
    "gte": 0,
    "then": "#00C853",
    "else": "#FF1744"
  }
}
```

**Supported Operators:**

- `gte` - Greater than or equal (≥)
- `gt` - Greater than (>)
- `lte` - Less than or equal (≤)
- `lt` - Less than (<)
- `eq` - Equals (===)
- `neq` - Not equals (!==)

**Use Cases:**

- Color positive/negative values differently
- Show/hide elements based on thresholds
- Format values based on magnitude

### Concat Binding

Concatenates multiple values (resolved bindings or literals) into a single string. Useful for appending units
to numeric values or building dynamic strings.

```json
{
  "concat": [{ "key": "options.ticker_height", "default": 5 }, "vh"]
}
```

With `ticker_height = 8`, this resolves to `"8vh"`.

**Use Cases:**

- Append CSS units to numeric option values (e.g., `vh`, `vw`, `em`, `px`)
- Build dynamic URLs or paths
- Compose formatted strings from multiple data sources

**Example: Resolution-Independent Stock Ticker**

The Stock Ticker widget demonstrates a common pattern for resolution-independent sizing:

```json
{
  "type": "scroller",
  "style": {
    "height": "100%",
    "width": "100%",
    "font-size": {
      "concat": [{ "key": "options.ticker_height", "default": 5 }, "vh"]
    }
  },
  "opts": {
    "gap": {
      "concat": [{ "key": "options.item_gap", "default": 3 }, "em"]
    }
  }
}
```

This pattern uses:

- **`vh` for font-size**: The base font-size scales with viewport height
- **`em` for gap**: Gap scales proportionally with font-size (which is in vh)
- **Percentage for dimensions**: Container fills available space

This approach ensures all internal elements scale proportionally based on screen height,
while numeric options (like `ticker_height: 5`) remain user-friendly without requiring
users to understand CSS units.

### Format Binding (`fmt`)

A text with placeholders: `{path | formatter:arg | …}`. If any placeholder is empty (missing value, `null`,
`""`), the whole text is `""`, so units next to a missing value disappear. `{{` and `}}` are literal braces.

```json
{ "fmt": "{data.price | number} kr" }
{ "fmt": "{$.start | date:'D/M'} kl.{$.start | date:'HH'}-{$.end | date:'HH'}" }
```

Paths are the same as `key`: `data.…`, `options.…`, `$.…` (or `$`, the current item), and `@global`
(`@now` is the current time and re-evaluates every minute; `@locale` is the playlist's locale).

| Formatter | Result |
|---|---|
| `number[:decimals[:group[:decimal]]]` | Grouped digits; `decimals` is a count or `auto` (default). Separators default to the locale's. |
| `date:pattern[:locale]` | Tokens `YYYY YY M MM MMM MMMM D DD d ddd dddd H HH h hh m mm A`; `[text]` is literal. |
| `timed` | The date, or empty if its time is midnight. |
| `upper`, `lower`, `capitalize`, `trim` | Text changes. |
| `truncate:n` | At most `n` characters, then `…`. |
| `default:'x'` | `x` when empty, so the text is never emptied by this placeholder. |

Dates without an offset are local wall-clock times. Day/month names and number separators are bundled for
en, es, sv, de, fr, zh, ar, ko and ja (no `Intl` needed on Chrome 38). The locale is the template's
`options.locale`, else the playlist's `locale` (the organization's display locale), else `en`.

Plain strings are never parsed: always wrap format texts as `{"fmt": …}`. The server rejects invalid
bindings when a widget is created and warns about plain strings that look like format texts.

### List Binding (`list`)

Builds a list from an array: `where` → `sort` → `item` → drop empty results → `limit` → `join`.

```json
{
  "list": {
    "key": "data.viewings",
    "where": [{ "key": "$.end", "gte": "@now" }],
    "sort": "$.start",
    "limit": 2,
    "item": { "fmt": "{$.start | date:'D/M'} kl.{$.start | date:'HH'}" },
    "join": ", "
  }
}
```

- `key` (a path) or `items` (a literal array whose elements may contain bindings).
- `where`: conditions with one of `eq`, `neq`, `gt`, `gte`, `lt`, `lte` or `present: true`. `@now` compares
  dates as instants.
- `sort` (a path) with optional `desc: true`; `limit`; `join` returns a string, otherwise an array.

Because empty results are dropped before `limit`, `items` + `where: [{ "key": "$.value", "present": true }]` +
`limit: 5` shows "the first five facts that have a value".

### First Binding (`first`)

The first value that is not empty. Use it for fallbacks, per-item overrides and optional parts:

```json
{ "first": [{ "key": "options.overrides.price" }, { "fmt": "{data.price | number} kr" }, "PÅ BEGÄRAN"] }
```

### Nested Bindings

All binding types support nested bindings. The values inside `cases`, `then`, `else`, and `concat`
arrays can themselves be bindings:

```json
{
  "switch": {
    "key": "$.type",
    "cases": {
      "stock": { "key": "options.stockColor" },
      "crypto": { "key": "options.cryptoColor" },
      "default": "#333333"
    }
  }
}
```

## Components

### List

Iterates over data arrays to create repeated elements (menus, schedules, feeds).

### Group

Container for organizing multiple components with shared styling.

### Text

Displays text content with support for autofit sizing.

### Image

Displays static or dynamic images with customizable sizing.

### Video

Plays video content with optional looping and controls.

### Layout

Embeds other playlists or widget compositions within a template.

### QR Code

Generates QR codes from dynamic or static data.

### Scroller

Creates horizontally or vertically scrolling content with configurable speed and direction.

## Type Guards

The binding system provides type guards for checking binding types:

- `isBinding(value)` - Checks for simple key bindings
- `isSwitchBinding(value)` - Checks for switch bindings
- `isConditionalBinding(value)` - Checks for conditional bindings
- `isConcatBinding(value)` - Checks for concat bindings
- `isFmtBinding(value)`, `isListBinding(value)`, `isFirstBinding(value)` - Check for formatting bindings
- `isAnyBinding(value)` - Checks if value is any type of binding

## Resolution Functions

- `resolveBinding(binding, config, context, globals)` - Resolves simple bindings
- `resolveSwitchBinding(binding, config, context, globals)` - Resolves switch bindings
- `resolveConditionalBinding(binding, config, context, globals)` - Resolves conditional bindings
- `resolveConcatBinding(binding, config, context, globals)` - Resolves concat bindings
- `resolveFmtBinding`, `resolveListBinding`, `resolveFirstBinding` - Resolve formatting bindings
- `resolveOption(option, config, context, globals)` - Universal resolver that handles all binding types
