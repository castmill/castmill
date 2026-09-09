# Generic Template Widget

This widget is a generic template widget that can be used to create new widgets. It is divided into two parts:
a **data model** and a **view**. The data model defines how the data is supposed to arrive at the widget, and the
view takes care of rendering the data.

The widget supports several smart components that can be used to create resolution-independent widgets.

## Data Model

### Formatters

The data model supports some built-in formatters that can be used to format the data before it is passed to the view.
Mostly to format numbers and dates.

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
- `isAnyBinding(value)` - Checks if value is any type of binding

## Resolution Functions

- `resolveBinding(binding, config, context, globals)` - Resolves simple bindings
- `resolveSwitchBinding(binding, config, context, globals)` - Resolves switch bindings
- `resolveConditionalBinding(binding, config, context, globals)` - Resolves conditional bindings
- `resolveConcatBinding(binding, config, context, globals)` - Resolves concat bindings
- `resolveOption(option, config, context, globals)` - Universal resolver that handles all binding types
