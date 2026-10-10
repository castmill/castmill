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
