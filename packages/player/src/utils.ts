export const applyCss = (
  element: HTMLElement,
  css: Partial<CSSStyleDeclaration>
) => {
  for (let key in css) {
    const styleProperty = css[key];
    if (styleProperty) {
      element.style[key] = styleProperty;
    }
  }
};
