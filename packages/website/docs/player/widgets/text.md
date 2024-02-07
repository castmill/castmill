# Text Component

The text component allows to display text in a defined area of the screen. As the text can come from a dynamic data source, the text component supports automatic resizing of the text to fit the available space, as well as scrolling of the text if it is too long to fit given a minimum
font size.

## Options

```typescript
export interface TextComponentOptions {
  text: string
  autofit: AutoFitOpts

  // Break text in chars when animating.
  chars?: boolean

  // Apply perspective to the text
  perspective?: number
}

interface AutoFitOpts {
  // Base size of the text (in em). Used if the text fits in the container.
  baseSize?: number

  // Maximum size the text can have (in em)
  maxSize?: number

  // Minimum size the text can have (in em) before scroll is enabled.
  minSize?: number
}
```
