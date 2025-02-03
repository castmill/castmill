type HandleResponseOptions = {
  parse?: boolean;
};

export async function handleResponse<T = any>(
  response: Response,
  options: { parse: true }
): Promise<T>;
export async function handleResponse<T = any>(
  response: Response,
  options?: { parse?: false }
): Promise<void>;
export async function handleResponse<T = any>(
  response: Response,
  options: HandleResponseOptions = {}
): Promise<T | void> {
  if (response.status >= 200 && response.status < 300) {
    if (options.parse) {
      return (await response.json()) as T;
    }
  } else {
    let errMsg = '';
    try {
      const { errors } = await response.json();
      errMsg = `${errors.detail || response.statusText}`;
    } catch (error) {
      errMsg = `${response.statusText}`;
    }
    // We should NOT throw an exception here. We should handle errors in a different way.
    throw new Error(errMsg);
  }
}
