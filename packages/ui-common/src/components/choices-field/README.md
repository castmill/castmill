# Choices Field

`ChoicesField` lets users pick one or more values from a list that someone else
provides, such as listings or photos from a widget integration, instead of typing
identifiers. It stores plain string values.

## Features

- **Single value**: shows the current choice as a card with **Change** and optional
  **Clear** actions.
- **Multiple values**: a strip of tiles with position badges. Reorder by dragging or
  with the move buttons (keyboard friendly), and remove items one by one.
- **Picker dialog**: search (debounced), incremental loading with **Load more**,
  arrow-key navigation, checkboxes, a selection counter, select all/none and
  `min`/`max` bounds. Added items are appended in click order.
- **Displays**: `list` (label and description), `cards` (thumbnail and text) and
  `grid` (thumbnail tiles).
- **Previews**: `image` (enlarge), `video` (muted playback on hover or with the play
  button), `audio` (one preview plays at a time) and `font` (renders a sample text).
  Unknown preview types fall back to the thumbnail and label.
- **Missing values**: saved values the provider no longer returns are shown as
  unavailable, with a remove action.
- **Dependencies**: `disabled` with a `disabledHint` until the fields it depends on
  are set; changing `reloadKey` reloads the details of the selected values.

The component has no built-in texts: pass all labels, already localized.

## Usage

```tsx
import { ChoicesField, ChoicesRequest } from '@castmill/ui-common';

<ChoicesField
  id="photos"
  label={t('photos')}
  value={photos()}
  multiple
  ordered
  max={30}
  display="grid"
  search
  labels={labels}
  loadChoices={(request: ChoicesRequest) => api.listChoices('photos', request)}
  errorMessage={(error) => t('choicesError')}
  onChange={setPhotos}
/>;
```

`loadChoices` receives `{ query, cursor, values }` and resolves to
`{ items, next }`. `values` are the current selection, so the provider can return
their details on the first page. Each item is a `Choice`:

```ts
interface Choice {
  value: string;
  label: string;
  description?: string;
  thumbnail_url?: string;
  preview?: { type: string; url: string; mime_type?: string };
  disabled?: boolean;
}
```

## Props

| Prop | Description |
|---|---|
| `id`, `label`, `description` | Field identity and texts. |
| `value` | A string, or a list of strings with `multiple`. |
| `multiple`, `ordered`, `min`, `max` | Selection mode and bounds. |
| `display` | `list` (default), `cards` or `grid`. |
| `search` | Shows a search box in the dialog. |
| `required` | Hides **Clear** for single values. |
| `disabled`, `disabledHint` | Disables the field and explains why. |
| `emptyHint` | Shown when a multiple selection is empty. |
| `reloadKey` | Changing it reloads the details of the selected values. |
| `labels` | Localized `ChoicesFieldLabels`. |
| `loadChoices` | Loads a page of choices. |
| `errorMessage` | Maps a `loadChoices` error to a localized message. |
| `onChange` | Receives the new value (`undefined` when a single value is cleared). |
| `searchDebounceMs` | Search debounce, 300 ms by default. |

See `agents/systems/WIDGET-OPTION-CHOICES.md` for how widget options use it.
