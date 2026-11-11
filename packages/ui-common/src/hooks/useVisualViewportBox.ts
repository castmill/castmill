import { Accessor, JSX, createSignal, onCleanup, onMount } from 'solid-js';

const readBox = (): JSX.CSSProperties | undefined => {
  const vv = typeof window !== 'undefined' ? window.visualViewport : null;
  if (!vv) return undefined;

  const panned = vv.offsetLeft !== 0 || vv.offsetTop !== 0;
  const shrunk =
    window.innerWidth - vv.width > 1 || window.innerHeight - vv.height > 1;
  if (!panned && !shrunk) return undefined;

  return {
    left: `${vv.offsetLeft}px`,
    top: `${vv.offsetTop}px`,
    right: 'auto',
    bottom: 'auto',
    width: `${vv.width}px`,
    height: `${vv.height}px`,
  };
};

/**
 * Inline box that pins a `position: fixed; inset: 0` layer to the visible
 * area. Mobile browsers grow the layout viewport when the page overflows
 * horizontally (or shrink the visual one for the on-screen keyboard), so a
 * plain fixed overlay can end up centred outside what the user sees.
 * Returns undefined when both viewports match, leaving the CSS in charge.
 */
export function useVisualViewportBox(): Accessor<
  JSX.CSSProperties | undefined
> {
  const [box, setBox] = createSignal(readBox());

  onMount(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox(readBox());
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    update();
    onCleanup(() => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    });
  });

  return box;
}
