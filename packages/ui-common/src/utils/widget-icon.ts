/**
 * Widget icons are absolute URLs, data URIs, backend-relative paths ("/...")
 * or short text/emoji glyphs.
 */

/** True when the icon is an image reference rather than a text glyph. */
export const isImageIcon = (icon: string | null | undefined): icon is string =>
  !!icon && /^(data:image\/|https?:\/\/|\/)/.test(icon);

/**
 * Image URL for an icon, prepending `baseUrl` to backend-relative paths.
 * Protocol-relative URLs ("//host/...") are left unchanged.
 */
export const getIconUrl = (
  icon: string | null | undefined,
  baseUrl: string
): string | undefined => {
  if (!icon) return undefined;
  return icon.startsWith('/') && !icon.startsWith('//')
    ? `${baseUrl}${icon}`
    : icon;
};

/** Splits a widget icon into an image `src` or a text `glyph`. */
export const resolveWidgetIcon = (
  icon: string | null | undefined,
  baseUrl: string
): { src?: string; glyph?: string } => {
  const value = icon?.trim();
  if (!value) return {};
  return isImageIcon(value)
    ? { src: getIconUrl(value, baseUrl) }
    : { glyph: value };
};
