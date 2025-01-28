type ScapFn<T, R> = (
  successCallback: (result: R) => void,
  errorCallback: (error: any) => void, // eslint-disable-line @typescript-eslint/no-explicit-any
  options: T
) => void;
type ScapFnNoOpt<R> = (
  successCallback: (result: R) => void,
  errorCallback: (error: any) => void // eslint-disable-line @typescript-eslint/no-explicit-any
) => void;

type PromisifiedFn<T, R> = (options: T) => Promise<R>;
type PromisifiedFnNoOpt<R> = () => Promise<R>;

export function promisify<T, R>(fn: ScapFn<T, R>): PromisifiedFn<T, R> {
  return (options: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      fn(resolve, reject, options);
    });
  };
}

export function promisifyNoOpt<R>(fn: ScapFnNoOpt<R>): PromisifiedFnNoOpt<R> {
  return (): Promise<R> => {
    return new Promise((resolve, reject) => {
      fn(resolve, reject);
    });
  };
}

export function promisifyNoRet<T>(fn: ScapFn<T, void>): PromisifiedFn<T, void> {
  return (options: T): Promise<void> => {
    return new Promise((resolve, reject) => {
      fn(resolve, reject, options);
    });
  };
}

export function promisifyNoOptNoRet(
  fn: ScapFn<void, void>
): PromisifiedFn<void, void> {
  return (): Promise<void> => {
    return new Promise((resolve, reject) => {
      fn(resolve, reject);
    });
  };
}
