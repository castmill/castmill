/**
 * Utility functions for handling widget icons
 */

/**
 * Checks if the icon string represents an image URL (data URI, http/https, or relative path)
 * rather than an icon symbol/character.
 */
export const isImageIcon = (icon: string | undefined): boolean => {
  if (!icon) return false;
  return (
    icon.startsWith('data:image/') ||
    icon.startsWith('http://') ||
    icon.startsWith('https://') ||
    icon.startsWith('/')
  );
};

/**
 * Constructs the full icon URL, prepending baseUrl for relative paths.
 */
export const getIconUrl = (
  icon: string | undefined,
  baseUrl: string
): string | undefined => {
  if (!icon) return undefined;
  // If icon starts with /, prepend baseUrl (relative to server)
  if (icon.startsWith('/')) {
    return `${baseUrl}${icon}`;
  }
  return icon;
};
