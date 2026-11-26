const SERVER_URL_META_NAME = 'castmill-server-url';

const isLegacyPath = (pathname: string): boolean =>
  pathname === '/legacy' || pathname.startsWith('/legacy/');

/**
 * Returns the Castmill server URL declared by the page that serves the adapter,
 * e.g. a proxy on another origin:
 * `<meta name="castmill-server-url" content="https://castmill.example.com">`.
 */
export const getServedServerUrl = (
  doc: Pick<Document, 'querySelector'>
): string | undefined => {
  const content = doc
    .querySelector(`meta[name="${SERVER_URL_META_NAME}"]`)
    ?.getAttribute('content')
    ?.trim();

  if (!content || !/^https?:\/\/[^/]/i.test(content)) {
    return undefined;
  }

  return content.replace(/\/+$/, '');
};

export const getLegacyBaseUrl = (
  location: Pick<Location, 'origin' | 'pathname'>,
  configuredBaseUrl?: string,
  servedServerUrl?: string
): string | undefined => {
  if (isLegacyPath(location.pathname)) {
    return location.origin;
  }

  return configuredBaseUrl ?? servedServerUrl;
};
