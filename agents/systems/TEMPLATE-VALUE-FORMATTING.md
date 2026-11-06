# Template Value Formatting

> **Status: Implemented.** Player: `packages/player/src/widgets/template/binding.ts` and
> `packages/player/src/widgets/template/format/`. Server validation:
> `Castmill.Widgets.TemplateBindings`. Shared grammar fixtures:
> `packages/player/tests/fixtures/fmt-grammar.json`.

## Problem

Template bindings can insert a value (`key`), pick between values (`switch`, `cond`)
and join values (`concat`). They cannot format anything: numbers, prices, dates,
times or lists. The player has a placeholder for formatters
(`packages/player/src/widgets/template/data/formatters.ts`, and a TODO in
`text.tsx`) that was never implemented.

As a result, integrations format values on the server. That is the wrong place:

1. **Time-dependent values go stale.** "The next two viewings" depends on the current
   time. If the server decides, a screen that is offline or has not refreshed keeps
   showing viewings that already happened. Only the player knows the time.
2. **Every template formats differently.** The legacy property listing templates
   (30 offices) use about a dozen viewing formats (`D/M kl.HH-HH`,
   `dddd DD/MM KL. HH:mm-HH:mm`, `ddd DD.M HH.mm-HH.mm`, `D MMMM HH:mm-HH:mm`, …),
   space- or dot-separated thousands, and units such as `kr`, `kr/mån`, `SEK/MÅN`,
   `kvm`, `m²` and `ROK`. A fetcher serves many templates and cannot know which
   format each one wants.
3. **It is not reusable.** RSS dates, calendar events, weather and prices in other
   widgets need the same capabilities.

## Goals

- Templates declare how values are shown; the player formats them.
- A small, fixed set of formatters. No general expression language, no `eval`, no
  arithmetic.
- Identical results in the dashboard preview and on players, including Chrome 38
  (legacy Android 5.1 and WebOS): no dependency on `Intl` or locale data in the
  browser.
- Locale-aware (the nine dashboard languages), with an explicit per-template override.
- Fully backward compatible: existing templates are unaffected.

## Non-goals

Arithmetic, user-defined functions, HTML output, plural rules, relative dates
("tomorrow"), and converting between arbitrary IANA time zones on the player. Any of
these can be proposed later.

## Overview

Three new binding types, resolved by `resolveOption` like the existing ones, so they
work in every component option and in style values:

| Binding | Purpose |
|---|---|
| `fmt` | A text with placeholders: `{path \| formatter \| …}` |
| `list` | Build a list from an array: filter, sort, map, limit, join |
| `first` | The first non-empty of several values (fallbacks, overrides) |

```json
{ "fmt": "{data.price | number} kr" }
```

## `fmt` binding

```
fmt         := ( literal | placeholder )*
placeholder := "{" path ( "|" formatter )* "}"
formatter   := name ( ":" arg )*
arg         := "'" text "'" | number | word
literal     := any text; write "{{" and "}}" for literal braces
```

- `path` is the same as a binding `key`: `data.…`, `options.…`, `$.…` (the current
  list item or list component context) and `@global`.
- Formatters apply left to right.

### Missing values

If a placeholder resolves to a missing value, `null` or `""` (after its formatters),
**the whole `fmt` resolves to `""`**. That way `"{data.fee | number} kr/mån"` does
not leave a dangling `kr/mån` when the listing has no fee, and empty facts disappear
(see `list`).

### Optional parts

A text with an optional part is written as alternatives with `first`: the first
alternative that does not resolve to empty is used. For a viewing whose end time may
be missing:

```json
{ "first": [
  { "fmt": "kl.{$.start | date:'HH'}-{$.end | date:'HH'}" },
  { "fmt": "kl.{$.start | date:'HH'}" }
] }
```

Without an end time the first alternative is empty, so the second is used. Every
legacy listing text has at most one optional part, so this is enough today. Optional
placeholders (with `prefix`/`suffix` formatters for their separators) can be added
later if templates need several optional parts in one text.

### Formatters

| Formatter | Input | Result |
|---|---|---|
| `number[:decimals[:group[:decimal]]]` | number or numeric string | Grouped digits. `decimals` is a count or `auto` (default: keep the value's decimals). `group` and `decimal` default to the locale's separators. Non-numeric strings such as `3-4` pass through unchanged. |
| `date:pattern[:locale]` | ISO 8601 string or epoch milliseconds | Formatted date/time (tokens below). |
| `timed` | date | Passes the value through only if its time of day is not midnight; otherwise empty. Combine with `first` for "date only when there is no time". |
| `upper`, `lower`, `capitalize` | text | Case changes (`capitalize` uppercases the first character). |
| `trim` | text | Removes surrounding whitespace. |
| `truncate:n` | text | Cuts to `n` characters and adds `…`. |
| `default:'x'` | any | Uses `x` when the value is empty, so the placeholder never empties the `fmt`. |

Date tokens (moment-compatible subset): `YYYY YY M MM MMM MMMM D DD d ddd dddd H HH h
hh m mm A`. Text in `[brackets]` is literal. Day and month names come from tables
bundled with the player.

## `list` binding

```json
{
  "list": {
    "key": "data.viewings",
    "where": [{ "key": "$.end", "gte": "@now" }],
    "sort": "$.start",
    "limit": 2,
    "item": { "first": [
      { "fmt": "{$.start | date:'D/M'} kl.{$.start | date:'HH'}-{$.end | date:'HH'}" },
      { "fmt": "{$.start | date:'D/M'} kl.{$.start | date:'HH'}" }
    ] },
    "join": ", "
  }
}
```

| Attribute | Meaning |
|---|---|
| `key` or `items` | The source array: a path, or a literal array whose elements may contain bindings (resolved first). |
| `where` | Conditions on each element; all must hold. Uses the `cond` operators (`eq`, `neq`, `gt`, `gte`, `lt`, `lte`) plus `present: true`. `@now` compares dates as instants. |
| `sort` | Path to sort by, with optional `"desc": true`. |
| `item` | Binding evaluated per element with `$` = the element. Default: the element itself. |
| `limit` | Maximum number of elements. |
| `join` | If given, the result is a string; otherwise an array. Arrays can feed `paginated-list`, `image-carousel.images`, and so on. |

**Order:** resolve `items` → `where` → `sort` → `item` → drop empty results → `limit` →
`join`. Because empty results are dropped *before* `limit`, a list of facts naturally
shows "the first five facts that have a value". That is what the legacy templates did
with `.filter(info => info.value).slice(0, 5)`.

## `first` binding

```json
{ "first": [{ "key": "options.overrides.price" }, { "fmt": "{data.price | number} kr" }, "PÅ BEGÄRAN"] }
```

Returns the first element that resolves to a non-empty value. It is used for fallbacks
and for per-item override texts.

## Locale and time zone

**Number separators.** The bundled tables follow CLDR. For `sv` and `fr` the group
separator is a no-break space (U+00A0), not the normal space the legacy templates used:
it looks the same and prevents a price from breaking across lines.

**Locale.** Resolution order: the formatter's argument, then the template's `locale`
option if it has one, then the `@locale` global, then `en`. `@locale` is the
organization's display locale, which integrations already use on the server. It is
not sent to players today, so this proposal adds it to the playlist JSON. The player
bundles day/month names and number separators for the nine dashboard locales (about
3 KB).

**Time zone.** Values with an offset are converted to the player's local time.
Values without an offset (many listing systems send `2026-11-12T17:00:00`) are
wall-clock times in the player's zone. Players and their displays run in the
display's local zone, so `@now` comparisons are correct there.

The dashboard preview uses the browser's zone, which may differ for users in another
zone. That is acceptable for a preview.

**Chrome 38 caveat.** ES5 engines parse `new Date("2026-11-12T17:00")` as UTC, while
modern engines parse it as local time. The implementation must parse ISO strings
itself.

## When values are evaluated

Bindings are evaluated when the template renders. Devices re-render a playlist's
widgets each time they reload the playlist (every loop), so `@now` filters stay
correct even while a device is offline.

An item can also stay on screen for a long time, for example a layout zone that plays
for hours or a playlist with a single item. Bindings that use `@now` are therefore
re-evaluated **once a minute while the widget is shown**. `@now` is a reactive global
that changes every 60 seconds. Only the options that depend on it are resolved again,
so other components are not re-rendered; on old hardware a minute is cheap enough.
Text whose content changes is fitted again, as when data changes.

## Validation

The server's widget validator (used on upload and install) parses every `fmt` and
`list` and rejects:

- unknown formatters;
- wrong argument counts;
- unbalanced braces;
- `where` operators that don't exist.

Errors point to the component name, so template authors see mistakes at upload time
rather than on a screen. It also warns about plain strings that look like a `fmt`
without its wrapper.

## Compatibility and rollout

- Existing templates use none of the new keys and behave as before.
- No player for the new Castmill has been released yet, so every player supports these
  bindings from its first release. No capability flag or minimum player version is
  needed.
- The player is embedded in the device bundle and the legacy adapter, so both get it
  with the same player version.

## Legacy coverage (property listings)

| Legacy output | Expression |
|---|---|
| `12/11 kl.17-18` (Pontus) | `{$.start \| date:'D/M'} kl.{$.start \| timed \| date:'HH'}-{$.end \| date:'HH'}` |
| `12/11 kl.17` (no end time) | `first` alternative `{$.start \| date:'D/M'} kl.{$.start \| timed \| date:'HH'}` |
| `12/11` (viewing at midnight: date only) | last `first` alternative `{$.start \| date:'D/M'}`; `timed` empties the alternatives above |
| `Måndag 06/11 KL. 14:00-15:00` (Husrum) | `{$.start \| date:'dddd DD/MM' \| capitalize} KL. {$.start \| date:'HH:mm'}-{$.end \| date:'HH:mm'}`, with a `first` alternative without the end |
| `Mån 06.11 14.00-15.00` (SFF) | `{$.start \| date:'ddd DD.M' \| capitalize} {$.start \| date:'HH.mm'}…` |
| `12 november 17:00-18:00` (SMH, MOHV) | `{$.start \| date:'D MMMM'} {$.start \| date:'HH:mm'}…` |
| `VISNING …` (SVDK) | `{… \| upper}` |
| `4 950 000 kr` | `{data.price \| number} kr` |
| `4.950.000` (SFF, Nyva) | `{data.price \| number:0:'.'}` |
| `3 337 kr/mån`, `SEK/MÅN`, `kvm`, `m²`, `ROK` | literal suffixes |
| Hide a fact without value, show the first 5 | `list` with `items`, `where: present`, `limit: 5` |
| Status label (`sold` → `Såld`) | existing `switch` binding |
| `ENLIGT ÖK` when there is no viewing | `first` |

Not covered: the legacy phone-number regrouping helpers. Brokers' systems already
return formatted phone numbers; a `phone` formatter can be added if needed.

## Consequences for integrations

Fetchers return normalized, unformatted data: numbers as numbers, dates as ISO 8601
strings, units as codes, and lists as arrays of objects. The property listing fetcher
in castmill-saas will be changed accordingly.

Item override texts become `options.overrides.<field>` with flat field names (for
example `price`, `rooms`). The migration maps the legacy key paths to these names.

## Testing

- Unit tests per formatter and locale.
- Date parsing tests that run under ES5 semantics.
- Golden tests reproducing every legacy format in the table above.
- Grammar tests shared between the player (TypeScript) and the server validator
  (Elixir), driven by the same fixtures.

## Decisions

- **Explicit `{"fmt": …}` only.** Plain strings are never parsed for placeholders.
  Template strings legitimately contain braces (inline SVG images, CSS values), and
  every other binding is an object too. The validator warns about plain strings that
  look like placeholders, such as `"{data.price | number} kr"`, so a forgotten wrapper
  is caught at upload.
- Optional placeholders and `prefix`/`suffix` are left out until a template needs
  several optional parts in one text (see "Optional parts").
