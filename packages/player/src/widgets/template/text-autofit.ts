export function observeTextContainerResize(
  textElement: HTMLDivElement,
  onResize: () => void
): ResizeObserver | null {
  if (typeof ResizeObserver === 'undefined') {
    return null;
  }

  const parentElement = textElement.parentElement;
  if (!parentElement) {
    return null;
  }

  const observer = new ResizeObserver(() => {
    onResize();
  });

  observer.observe(parentElement);
  return observer;
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
