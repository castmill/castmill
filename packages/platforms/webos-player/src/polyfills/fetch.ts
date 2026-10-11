type HeaderSource = RequestInit['headers'];

function forEachHeader(
  headers: HeaderSource,
  set: (name: string, value: string) => void
): void {
  if (!headers) return;
  if (Array.isArray(headers)) {
    headers.forEach(([name, value]) => set(name, value));
  } else if (typeof (headers as Headers).forEach === 'function') {
    (headers as Headers).forEach((value, name) => set(name, value));
  } else {
    const record = headers as Record<string, string>;
    Object.keys(record).forEach((name) => set(name, record[name]));
  }
}

/**
 * Minimal XHR-based fetch for webOS 3.x (Chrome 38), which has no fetch.
 * Like fetch, every HTTP status resolves; callers inspect `ok`/`status`.
 * Never logs URLs, headers or bodies because they can contain credentials.
 */
const fetchPolyfill = (
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> =>
  new Promise((resolve, reject) => {
    if (typeof input !== 'string' && !(input instanceof URL)) {
      reject(new TypeError('fetchPolyfill: Request objects are unsupported'));
      return;
    }
    const xhr = new XMLHttpRequest();
    const fail = (error: Error) => setTimeout(() => reject(error), 0);

    xhr.onload = () => {
      const text = () => Promise.resolve(xhr.responseText);
      resolve({
        status: xhr.status,
        statusText: xhr.statusText,
        ok: xhr.status >= 200 && xhr.status < 300,
        url: String(input),
        headers: {
          get: (name: string) => xhr.getResponseHeader(name),
          has: (name: string) => xhr.getResponseHeader(name) !== null,
        },
        text,
        json: () => text().then((body) => JSON.parse(body)),
      } as unknown as Response);
    };
    xhr.onerror = () => fail(new TypeError('Network request failed'));
    xhr.ontimeout = () => fail(new TypeError('Network request timed out'));
    xhr.onabort = () => fail(new DOMException('Aborted', 'AbortError'));

    xhr.open(init?.method ?? 'GET', String(input));
    forEachHeader(init?.headers, (name, value) =>
      xhr.setRequestHeader(name, value)
    );
    const body = init?.body as XMLHttpRequestBodyInit | null | undefined;
    if (body !== undefined && body !== null) {
      xhr.send(body);
    } else {
      xhr.send();
    }
  });

if (!window.fetch) {
  window.fetch = fetchPolyfill;
}
