export function observeTextContainerResize(
  textElement: HTMLDivElement,
  onResize: () => void
): () => void {
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }

  const parentElement = textElement.parentElement;
  if (!parentElement) {
    return () => {};
  }

  const observer = new ResizeObserver(() => {
    onResize();
  });

  observer.observe(parentElement);
  return () => observer.disconnect();
}

/**
 * Calls `onResize` when `element` changes size. Without ResizeObserver (e.g.
 * Chrome 38 players) it follows window resizes and changes to the element's
 * inline style, which is how the player letterboxes widgets (Layer).
 */
export function observeElementResize(
  element: HTMLElement,
  onResize: () => void
): () => void {
  if (typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', onResize);
    const styleObserver =
      typeof MutationObserver === 'undefined'
        ? null
        : new MutationObserver(() => onResize());
    styleObserver?.observe(element, {
      attributes: true,
      attributeFilter: ['style'],
    });
    return () => {
      window.removeEventListener('resize', onResize);
      styleObserver?.disconnect();
    };
  }

  const observer = new ResizeObserver(() => onResize());
  observer.observe(element);
  return () => observer.disconnect();
}

export function observeTextContentChanges(
  textElement: HTMLDivElement,
  onChange: () => void
): MutationObserver | null {
  if (typeof MutationObserver === 'undefined') {
    return null;
  }

  const observer = new MutationObserver(() => {
    onChange();
  });

  observer.observe(textElement, {
    childList: true,
    characterData: true,
    subtree: true,
  });

  return observer;
}
