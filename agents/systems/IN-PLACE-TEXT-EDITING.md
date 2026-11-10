# In-Place Text Editing for Template Widgets

> **Status: Implemented** (server, player and dashboard). Server:
> `Castmill.Widgets.TemplateBindings` (`editable`, `editables/1`) and
> `Castmill.Widgets.TextOverrides`. Player: `editable` on text components
> (`packages/player/src/widgets/template/text.tsx`). Dashboard:
> `EditableTextStage`, `TextOverridesList` and `text-overrides.ts` in
> `addons/playlists/components`. Mapping legacy overrides is part of the property
> listing migration.
> Related: [TEMPLATE-VALUE-FORMATTING.md](./TEMPLATE-VALUE-FORMATTING.md).

## Problem

Customers often need to change a single text shown by a template widget on one playlist item, without
changing the data source or the template:

- **A property listing:** show "PÅ BEGÄRAN" instead of the price, or "120+ KVM" instead of the living area.
- **An office's opening-hours screen** (Länsförsäkringar): adjust a line for one office.

Legacy Castmill let users **click a text in the preview and type over it**. The replacement was stored as
an *override* for that item (`media.overrides`, keyed by a key path), and a single "." meant "show
nothing" (`dooh-widgets/widgets/occusell/public/components/editable.vue`). Customers rely on this, and
migrated items carry overrides (about 10% of the legacy property listing layers).

The new Castmill has no way to edit such overrides. The settings form cannot even show them, because
`map` options aren't implemented in the form.

## Goals

- **Template-declared:** a template marks which texts may be edited, and under which key.
- **The player shows overrides** without changing how templates are written otherwise.
- **The dashboard edits texts where they appear,** in the widget preview, with a clear overview and reset.
- **Works for every template widget,** not only property listings.

## Non-goals

- Editing images or styles in place (possible later with the same mechanism).
- Rich text: overrides are plain text.
- Changing the data source: overrides only change what one playlist item shows.

## Template syntax

A `text` component can declare an `editable` attribute:

```json
{
  "type": "text",
  "name": "street",
  "opts": { "text": { "key": "data.street" } },
  "editable": { "key": "street", "label": "Street address", "multiline": false, "max_length": 80 }
}
```

| Attribute | Meaning |
|---|---|
| `key` | The override key: a string, or a binding resolving to a string, for texts inside lists. For example, `{ "fmt": "fact.{$.id}" }` gives each fact its own key. |
| `label` | Shown in the editor and in the overrides list: a string, or a binding (e.g. a fact's own label). Translated through the widget's `translations` under `translations.<locale>.editable.<label>`. |
| `multiline` | Allow line breaks (default `false`) |
| `max_length` | Maximum length, 1 to 5000 (default 500) |

`Castmill.Widgets.TemplateBindings` validates `editable` together with the other bindings when a widget
is created or uploaded: only on `text` components, no unknown attributes, a key (string of up to 200
characters, or a binding), and the types above.

## Stored overrides

Overrides are stored in the playlist item's options under the reserved key `overrides`:

```json
{
  "overrides": {
    "street": { "text": "Hemlig adress" },
    "fact.price": { "text": "PÅ BEGÄRAN" },
    "viewings": { "hidden": true }
  }
}
```

- Each value is either `{ "text": "…" }` or `{ "hidden": true }`. An explicit "hide" replaces the legacy
  "." convention.
- `overrides` is a reserved option for every widget whose template has editable components. It doesn't
  need to be declared in `options_schema`.
- The server validates the shape (`Castmill.Widgets.TextOverrides`, in the `WidgetConfig` changeset):
  string keys of up to 200 characters, at most 200 entries, and `text` within the component's
  `max_length`. Keys from bindings can't be matched on the server, so their texts may use the largest
  `max_length` of the template.
- Widgets that declare their own `overrides` option in `options_schema` keep it unchanged.
- Keys that no longer match an editable text (e.g. after a template update, or a fact that disappeared)
  are kept but ignored. The dashboard lists them as "unused" with a remove action.

## Player behavior

- **Override first:** when a text component has `editable`, the player resolves its key, then shows:
  - `overrides[key].text` if set;
  - nothing (the component renders empty and keeps its box) if `hidden`;
  - otherwise the normal `opts.text` binding.
- **Edited texts are never formatted.** An override bypasses the component's whole text binding, so
  no formatting applies to it:
  - `fmt` placeholders and their formatters (`number`, `date`, `upper`, …);
  - literal text around the placeholders, e.g. the " kr" in `"{data.price | number} kr"`;
  - `first` fallbacks;
  - `list` item formatting.
  Users type exactly what should appear. For example, an edited price shows "PÅ BEGÄRAN", not
  "PÅ BEGÄRAN kr", and an edited "1 929" stays "1 929" instead of being reformatted as a number.
- **Styling still applies:** fonts, colors, CSS `text-transform` and autofit are styles, not formatting,
  so they still apply. Template authors who want an edited text to keep its exact case should not use
  `text-transform` on editable texts and should use the `upper`/`lower` formatters instead; the
  validator warns when an editable text has `text-transform`.
- **Inside lists:** an override only replaces the edited text itself. For example, editing a fact's value
  doesn't change its label, and the label keeps its own formatting.
- **Fitting:** autofit and every other text behavior apply to overridden texts as usual.
- **Line breaks:** overrides of `multiline` texts keep their line breaks (`white-space: pre-line`).
- **Dashboard hook:** for the editor, the rendered element carries `data-editable-key`,
  `data-editable-label`, `data-editable-multiline`, `data-editable-max-length` and
  `data-editable-overridden` (`text` or `hidden`). These are attributes only; players ignore them.

## Dashboard UX/UI

In the widget settings dialog, next to the existing preview:

- **"Edit texts" mode:** a toggle on the preview.
  - It pauses the preview at its current position, so animations and carousels don't move under the
    pointer.
  - It outlines every editable text, highlighting it on hover with its label as a tooltip.
- **Editing a text:**
  - **Clicking a text** opens a small editor **anchored over it**: a text input, or a text area when
    `multiline`. It's prefilled with the currently shown text.
  - Editing directly inside the rendered element (contenteditable) is avoided, because autofit resizes
    the text while typing.
  - The editor is prefilled with the text **as currently shown**, i.e. already formatted (e.g.
    "4 950 000 kr"). What the user saves is shown exactly as typed from then on. "Reset to original"
    brings back the bound, formatted value.
  - Actions: **Save** (Enter; Ctrl/Cmd+Enter when multiline), **Cancel** (Esc), **Hide this text**, and
    **Reset to original** (only when overridden). A character counter appears near `max_length`.
  - Changes update the preview immediately and mark the form as modified. They're stored with the item's
    other settings when the dialog is saved.
  - Saving a text unchanged (when it isn't overridden yet) stores nothing, so the bound value keeps its
    formatting and updates.
- **Overrides list** in the settings form ("Edited texts (3)"):
  - each override with its label, its text or "Hidden", and a reset action;
  - a "Reset all" action;
  - unused keys listed separately. Keys of texts inside lists are only known once rendered, so when a
    template has such texts, overrides are never reported as unused.
- **Keyboard and accessibility:** in edit mode, Tab moves between editable texts and Enter opens the
  editor. Outlines also work with high-contrast settings, and labels are announced.
- **Playlist list:** items with overrides show a small "edited" indicator.
- All strings in the nine dashboard languages.

Implementation notes:

- `EditableTextStage` wraps the preview. It finds the editable texts by their `data-editable-*`
  attributes, rescans when the player re-renders, and pauses playback through `WidgetView`'s `paused`
  prop. Escape closes the editor without closing the settings dialog.
- The settings form keeps `overrides` when saving (`normalizeWidgetOptionsForApi`) and leaves it out of
  integration data requests. Widgets with editable texts but no options still open the settings dialog.
- Texts: `widgets.editableTexts.*` in the dashboard locales.

## Migration from legacy

Legacy overrides are nested key paths (`price.startingPrice`, `interior.numberOfRooms`). Each ported
template package maps them to its editable keys (e.g. `price.startingPrice` → `fact.price`), extending
the `override_aliases` the property listing packages already have. A legacy "." becomes
`{ "hidden": true }`.

Overrides whose key has no editable text in the ported template are reported as warnings, so the
template author can add the missing editable text before approval.

## Tests

- **Template validation:** the `editable` attribute and keys from bindings; the warning for editable texts
  with `text-transform`.
- **Server:** `overrides` shape validation and limits.
- **Player:**
  - override, hidden and missing keys;
  - overrides are shown verbatim: no `fmt`, formatters, surrounding literals or `first` fallbacks are
    applied, while styles and autofit still apply;
  - keys inside lists;
  - autofit with overrides;
  - no change for templates without `editable`.
- **Dashboard:** edit mode, anchored editor, keyboard flow, overrides list, reset, i18n.
- **Migration:** mapping legacy overrides, including "." and unknown keys.
- **More than 90% coverage on new code.**

## Decisions and future work

1. Any user who can edit the playlist can edit its texts; there is no per-widget lock.
2. Overrides of images (e.g. replacing a listing photo with a media from the library) would be a
   separate proposal using the same `editable` and `overrides` mechanism.
