import { Accessor, createSignal, onCleanup, onMount } from 'solid-js';

/** CSS custom property holding the on-screen keyboard height. */
export const KEYBOARD_INSET_PROPERTY = '--cm-keyboard-inset';
/** Attribute set on the target element while the keyboard is open. */
export const KEYBOARD_OPEN_ATTRIBUTE = 'data-keyboard-open';

// Browser toolbars collapsing/expanding change the visual viewport by a few
// dozen pixels; anything smaller than this is not a keyboard.
const MIN_KEYBOARD_PX = 80;

/**
 * Height (in CSS px) of the part of the layout viewport hidden below the
 * visual viewport, i.e. the on-screen keyboard. Returns 0 without
 * `visualViewport`, while pinch-zoomed, or when the browser already resizes
 * the layout viewport for the keyboard (`interactive-widget=resizes-content`).
 */
export function readKeyboardInset(): number {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return 0;
  // While zoomed in the visual viewport is smaller by design.
  if (typeof vv.scale === 'number' && Math.abs(vv.scale - 1) > 0.01) return 0;

  const hidden = Math.round(window.innerHeight - vv.height - vv.offsetTop);
  return hidden >= MIN_KEYBOARD_PX ? hidden : 0;
}

/**
 * Publishes the keyboard height as `--cm-keyboard-inset` (in px) and toggles
 * `data-keyboard-open` on `target` (the `<html>` element by default), so
 * `position: fixed` bars can use `bottom: var(--cm-keyboard-inset, 0em)` to
 * stay above the keyboard on iOS Safari, which does not resize the layout
 * viewport. Returns a function that stops tracking and clears both.
 */
export function trackKeyboardInset(
  target: HTMLElement = document.documentElement,
  onChange?: (inset: number) => void
): () => void {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  let current = -1;

  const update = () => {
    const inset = readKeyboardInset();
    if (inset === current) return;
    current = inset;
    if (inset > 0) {
      target.style.setProperty(KEYBOARD_INSET_PROPERTY, `${inset}px`);
      target.setAttribute(KEYBOARD_OPEN_ATTRIBUTE, '');
    } else {
      target.style.removeProperty(KEYBOARD_INSET_PROPERTY);
      target.removeAttribute(KEYBOARD_OPEN_ATTRIBUTE);
    }
    onChange?.(inset);
  };

  update();
  if (!vv) {
    return () => undefined;
  }

  vv.addEventListener('resize', update);
  vv.addEventListener('scroll', update);
  return () => {
    vv.removeEventListener('resize', update);
    vv.removeEventListener('scroll', update);
    target.style.removeProperty(KEYBOARD_INSET_PROPERTY);
    target.removeAttribute(KEYBOARD_OPEN_ATTRIBUTE);
  };
}

/**
 * Solid hook around `trackKeyboardInset`: tracks the keyboard while the
 * owner is mounted and returns its height in CSS px (0 when closed).
 */
export function useKeyboardInset(target?: HTMLElement): Accessor<number> {
  const [inset, setInset] = createSignal(0);

  onMount(() => {
    const stop = trackKeyboardInset(
      target ?? document.documentElement,
      setInset
    );
    onCleanup(stop);
  });

  return inset;
}
