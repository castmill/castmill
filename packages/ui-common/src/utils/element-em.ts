/** Browser default font size (px), used when none can be computed. */
export const DEFAULT_EM_PX = 16;

/**
 * The element's computed font size in px, i.e. the size of 1em for
 * em-based container breakpoints. Falls back to 16px.
 */
export const elementEm = (el: Element): number =>
  parseFloat(getComputedStyle(el).fontSize) || DEFAULT_EM_PX;

/** Width of the element in em of its own font size (0 when hidden). */
export const widthInEm = (el: Element, width?: number): number =>
  (width ?? el.getBoundingClientRect().width) / elementEm(el);
