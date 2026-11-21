const fetchPolyfill = (
  input: RequestInfo | URL,
  init?: RequestInit | undefined
): Promise<Response> => {
  // Check the input. We only support a subset of the fetch API
  if (typeof input !== 'string') {
    throw new Error('fetchPolyfill: input is not a string');
  }

  // Crosswalk includes data URL fragments in the body. Upgrade cache URLs
  // written before revisions moved into MIME parameters, without losing data.
  const url = input.replace(
    /^(data:(?:application\/json|text\/javascript);charset=utf-8),([^#]*)#(\d+)$/,
    '$1;castmill-revision=$3,$2'
  );
  const method = init?.method ?? 'GET';
  const headers = (init?.headers as Record<string, string> | undefined) ?? {};
  const body = init?.body as string | undefined;

  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();

    xhr.onload = function () {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({
          status: xhr.status,
          statusText: xhr.statusText,
          text: async (): Promise<string> => await xhr.responseText,
          json: async (): Promise<string> => {
            return JSON.parse(xhr.responseText);
          },
          ok: true,
        } as Response);
      } else {
        reject(Error('HTTP request failed: ' + xhr.status));
      }
    };

    xhr.onerror = function () {
      setTimeout(function () {
        reject(new TypeError('Network request failed'));
      }, 0);
    };

    xhr.ontimeout = function () {
      setTimeout(function () {
        reject(new TypeError('Network request timed out'));
      }, 0);
    };

    xhr.onabort = function () {
      setTimeout(function () {
        reject(new DOMException('Aborted', 'AbortError'));
      }, 0);
    };

    xhr.open(method ?? 'GET', url);

    if (headers) {
      Object.keys(headers).forEach((key) => {
        const value = headers[key];
        xhr.setRequestHeader(key, value);
      });
    }

    if (body) {
      xhr.send(body);
    } else {
      xhr.send();
    }
  });
};

// Fetch API polyfill. Fetch exists on Android, but it doesn't support
// the special urls for cached data (content://...). XMLHttpRequest works with
// these urls, so we use that instead.
window.fetch = fetchPolyfill;
