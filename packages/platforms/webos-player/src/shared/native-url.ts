const NATIVE_URL =
  /^http:\/\/127\.0\.0\.1:9080\/castmill-cache\/([a-f0-9]{64}(?:\.[a-z0-9_-]+)?)$/i;

export function webosNativePath(url: string): string | undefined {
  const match = NATIVE_URL.exec(url);
  return match ? `file://internal/castmill-cache/${match[1]}` : undefined;
}

export function isWebosNativeUrl(url: string): boolean {
  return webosNativePath(url) !== undefined;
}

export function canDownloadNatively(
  url: string,
  serverOrigin = window.location.origin
): boolean {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.search || parsed.username || parsed.password || parsed.hash) {
    return false;
  }
  return (
    parsed.pathname.startsWith('/medias/') || parsed.origin !== serverOrigin
  );
}
