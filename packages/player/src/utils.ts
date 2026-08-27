import { JSX } from 'solid-js';

/**
 * Parses aspect ratio string "16:9" and returns the numeric ratio (width/height)
 */
export function parseAspectRatio(
  aspectRatio: string | undefined
): number | null {
  if (!aspectRatio) return null;

  const parts = aspectRatio.split(':');
  if (parts.length !== 2) return null;

  const width = parseFloat(parts[0]);
  const height = parseFloat(parts[1]);

  if (isNaN(width) || isNaN(height) || height === 0) return null;

  return width / height;
}

export const applyCss = (element: HTMLElement, css: JSX.CSSProperties) => {
  const styleDeclaration = (<unknown>css) as CSSStyleDeclaration;
  for (let key in styleDeclaration) {
    const styleProperty = styleDeclaration[key];
    if (styleProperty) {
      element.style[key] = styleProperty;
    }
  }
};
