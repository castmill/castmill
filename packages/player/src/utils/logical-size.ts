/**
 * DOM rectangles include the device's outer rotation; widget algorithms need
 * the same scaled dimensions in their original layout axes.
 */
export function getLogicalSize(element: Element): {
  width: number;
  height: number;
} {
  const { width, height } = element.getBoundingClientRect();
  let ancestor: Element | null = element;
  while (ancestor) {
    const orientation = ancestor.getAttribute('data-castmill-orientation');
    if (orientation !== null) {
      return orientation === '90' || orientation === '270'
        ? { width: height, height: width }
        : { width, height };
    }
    ancestor = ancestor.parentElement;
  }
  return { width, height };
}
