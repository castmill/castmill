type ScapFn<T, R> = (
  successCallback: (result: R) => void,
  errorCallback: (error: any) => void,
  options: T
) => void;
type ScapFnNoOpt<R> = (
  successCallback: (result: R) => void,
  errorCallback: (error: any) => void
) => void;
type ScapFnNoRet<T> = (
  successCallback: () => void,
  errorCallback: (error: any) => void,
  options: T
) => void;
type ScapFnNoOptNoRet = (
  successCallback: () => void,
  errorCallback: (error: any) => void
) => void;

type PromisifiedFn<T, R> = (options: T) => Promise<R>;
type PromisifiedFnNoOpt<R> = () => Promise<R>;
type PromisifiedFnNoRet<T> = (options: T) => Promise<void>;
type PromisifiedFnNoOptNoRet = () => Promise<void>;

export function promisify<T, R>(fn: ScapFn<T, R>): PromisifiedFn<T, R> {
  return (options: T): Promise<R> => {
    return new Promise((resolve, reject) => {
      fn(resolve, reject, options);
    });
  };
}

export function promisifyNoOpt<T, R>(
  fn: ScapFnNoOpt<R>
): PromisifiedFnNoOpt<R> {
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

export function promisifyNoOptNoRet<T>(
  fn: ScapFn<void, void>
): PromisifiedFn<void, void> {
  return (): Promise<void> => {
    return new Promise((resolve, reject) => {
      fn(resolve, reject);
    });
  };
}
