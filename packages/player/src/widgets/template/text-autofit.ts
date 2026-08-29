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
