const fetchPolyfill = (
  input: RequestInfo | URL,
  init?: RequestInit | undefined
): Promise<Response> => {
  // Check the input. We only support a subset of the fetch API
  if (typeof input !== 'string') {
    throw new Error('fetchPolyfill: input is not a string');
  }

  const url = input as string;
  const method = init?.method ?? 'GET';
  const headers = (init?.headers as Record<string, string> | undefined) ?? {};
  const body = init?.body as string | undefined;

  console.log('fetchUrl', url, headers, body);
  return new Promise(function (resolve, reject) {
    const xhr = new XMLHttpRequest();

    xhr.onload = function () {
      console.log('onLoad', xhr.status);
      console.log('onLoad', xhr.responseText);
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

if (!window.fetch) {
  window.fetch = fetchPolyfill;
}
