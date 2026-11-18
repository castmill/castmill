/**
 * Roving-focus keyboard support for `role="tablist"` buttons: Arrow keys
 * move to the previous/next tab (wrapping, mirrored in RTL), Home/End jump
 * to the first/last tab.
 *
 * Returns the index of the tab to select and calls `preventDefault()`, or
 * returns `undefined` when the key is not a tab navigation key.
 */
export const tabKeyTarget = (
  event: KeyboardEvent,
  current: number,
  count: number
): number | undefined => {
  if (count <= 0) return undefined;
  const target = event.currentTarget;
  const rtl =
    target instanceof Element && target.closest('[dir="rtl"]') !== null;
  const step = { ArrowRight: rtl ? -1 : 1, ArrowLeft: rtl ? 1 : -1 }[
    event.key as 'ArrowRight' | 'ArrowLeft'
  ];
  let next: number | undefined;
  if (step) next = (current + step + count) % count;
  else if (event.key === 'Home') next = 0;
  else if (event.key === 'End') next = count - 1;
  if (next !== undefined) event.preventDefault();
  return next;
};

/** Focuses (optionally) and scrolls a tab button into view. */
export const revealTab = (
  tab: HTMLElement | null | undefined,
  focus = false
) => {
  if (focus) tab?.focus();
  tab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
};
