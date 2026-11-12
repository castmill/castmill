---
sidebar_position: 9
title: Best practices
description: Design widgets that read well from a distance, run smoothly on low-end players, and fail gracefully.
---

## Readability at a distance

Screens are viewed from several meters away, often in passing. Design for a glance rather than for reading.

- Keep body text at 3.6 `em` or larger and headlines at 6 `em` or larger with [font scaling](./data-binding.mdx#font-scaling) enabled. At Full HD that is 36 and 60 pixels.
- Limit each screen to one message and a few supporting lines. Use a `paginated-list` instead of shrinking text to fit more items.
- Use strong contrast between text and background. Put text on a solid panel or a dark gradient when it overlays a photo.
- Prefer regular and bold weights of a sans-serif font. Thin weights disappear on bright screens and at low resolutions.
- Give each page enough time: a `pageDuration` of about one second per line of text, with a minimum of five seconds.
- Use colors to reinforce meaning, such as red for cancelled or busy, and always pair them with text for viewers who cannot distinguish them.
- Test the design in portrait as well as landscape, and inside a small layout zone, unless you set an [aspect ratio](./schemas.mdx#aspect-ratio).

## Performance on low-end players

Castmill players include Android 5.1 devices that render with a Chrome 38 engine, and older LG webOS displays. Widgets must work on these engines, not only in a current desktop browser.

### CSS

| Avoid | Use instead |
| --- | --- |
| CSS Grid (`display: grid`) | Nested flexbox groups, or absolute positioning |
| The `aspect-ratio` property | Explicit sizes, or the widget's `aspect_ratio` field |
| The flexbox `gap` property | `margin` on the items |
| `vw` and `vh` units | `em` units with font scaling, and percentages |
| CSS custom properties (`var(--x)`) | Literal values or [style bindings](./styling.mdx#conditional-styles) |
| `backdrop-filter` and large `filter: blur()` | Solid or semi-transparent backgrounds |

Use flexbox conservatively:

- Set `"flex-shrink": "0"` (or `"flex": "0 0 auto"`) on fixed-size elements such as images, badges and cards, so they do not collapse.
- Give text that uses auto-fit a dedicated area with a definite height.
- Set `"min-height": "0"` on flexible children that contain lists, so they can shrink below their content size.
- Check empty, short and long values. When a component is hidden with `when`, its siblings take its space.

### Media and animation

- Keep at most two videos loaded at the same time across the whole screen, including layout zones. Older devices have a limited number of hardware decoders, and additional videos stall or stay black.
- Use images sized for the screen. A 1920-pixel-wide image is enough for a Full HD display; with `ref` options, bind `files[@target]` so the player picks the right size.
- Animate `opacity` and transforms only, and limit the number of elements moving at the same time.
- Avoid word-by-word animations on long texts. Each word becomes a separate element.
- Keep templates shallow. Deeply nested groups multiply layout work on every page change.

### Data

- Return only the fields the template uses from a fetcher, and limit lists with `max_items` or a `list` binding with `limit`.
- Provide `default` values in `data_schema`, so the widget shows sensible content before the first fetch and when a source fails.
- Choose the longest `refresh_interval` that keeps the content useful.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| A style has no effect | Property names must be kebab-case (`font-size`, not `fontSize`). Lengths need units. |
| A text fills the whole widget or overlaps its siblings | Text components default to `width: 100%` and `height: 100%`. Set `flex` or explicit sizes. |
| A `paginated-list` shows nothing or a single page | The list needs a definite height. Check the `items` binding resolves to an array. |
| A component does not appear at all | Check its `when` and `filter` conditions, and that the binding path matches the data (`data.` versus `options.`). |
| The widget fails to render | Check the component `type` spelling. Unknown types are not rejected at upload but stop rendering in the player. |
| A formatted text is empty | If any placeholder of a `fmt` resolves to a missing, `null` or empty value, the whole text is empty. Check the paths, and use `first` for optional parts. |
| A `$styles` override is ignored | `$styles` works only on `group` and `text`. Filter values must equal the resolved value exactly, including type. |
| Sizes differ between preview and device | Enable `fontScale` on the root and replace `px`, `vw` and `vh` with `em` and percentages. |
| The layout breaks on older players | Remove CSS Grid, `gap` and `aspect-ratio`; see the table above. |
| The widget plays for the wrong length | Set a `duration` option, or check the playlist item duration. See [Widget duration](./components.mdx#widget-duration). |
| Integration data never appears | Check the integration credentials in the dashboard, the fetcher name, and that the `data.` paths match the fetcher output. |
