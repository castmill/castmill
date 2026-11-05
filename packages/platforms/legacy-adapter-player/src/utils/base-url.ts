export const getLegacyBaseUrl = (
  location: Pick<Location, 'origin' | 'pathname'>,
  configuredBaseUrl?: string
): string | undefined => {
  if (
    location.pathname === '/legacy' ||
    location.pathname.startsWith('/legacy/')
  ) {
    return location.origin;
  }

  return configuredBaseUrl;
};
