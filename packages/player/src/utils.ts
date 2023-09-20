import { JSX } from "solid-js";

export const applyCss = (element: HTMLElement, css: JSX.CSSProperties) => {
  const styleDeclaration = (<unknown>css) as CSSStyleDeclaration;
  for (let key in styleDeclaration) {
    const styleProperty = styleDeclaration[key];
    if (styleProperty) {
      element.style[key] = styleProperty;
    }
  }
};
