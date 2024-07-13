// type ScapFn<T, O> = (successCallback: (result: T) => void, errorCallback: (error: any) => void, options: O) => void;
// type ScapFn2<O> = (successCallback: () => void, errorCallback: (error: any) => void, options: O) => void;

// type PromisifiedFn<T, O> = (options: O) => Promise<T>;
// type PromisifiedFn2<O> = (options: O) => Promise<void>;

// export function promisify3<O>(fn: ScapFn<void, O>): PromisifiedFn<void, O> {
//   return (options: O): Promise<void> => {
//     return new Promise((resolve, reject) => {
//       fn(resolve, reject, options);
//     });
//   };
// }
// export function promisify<T,O>(fn: ScapFn<void, O>): PromisifiedFn<void, O>;
// export function promisify<T, O>(fn: ScapFn<T, O>): PromisifiedFn<T, O> {
//   return (options: O): Promise<T> => {
//     return new Promise((resolve, reject) => {
//       fn(resolve, reject, options);
//     });
//   };
// };

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
// type ScapFn2<O> = (successCallback: () => void, errorCallback: (error: any) => void, options: O) => void;

type PromisifiedFn<T, R> = (options: T) => Promise<R>;
type PromisifiedFnNoOpt<R> = () => Promise<R>;
type PromisifiedFnNoRet<T> = (options: T) => Promise<void>;
type PromisifiedFnNoOptNoRet = () => Promise<void>;
// type PromisifiedFn2<O> = (options: O) => Promise<void>;

// export function promisify<T, R>(fn: ScapFnNoOpt<R>): PromisifiedFnNoOpt<R>;
// export function promisify<T, R>(fn: ScapFnNoRet<T>): PromisifiedFnNoRet<T>;
// export function promisify<T, R>(fn: ScapFnNoOptNoRet): PromisifiedFnNoOptNoRet;
// export function promisify<T, R>(fn: ScapFn<T, R>): PromisifiedFn<T, R>;
// export function promisify<T, R>(fn: ScapFn<T, R> | ScapFnNoOpt<R> | ScapFnNoRet<T> | ScapFnNoOptNoRet): PromisifiedFnNoOpt<R> | PromisifiedFnNoRet<T> | PromisifiedFnNoOptNoRet | PromisifiedFn<T, R> {
//   return (options?: T): Promise<R> => {
//     if (options){
//       // We have options
//       return new Promise((resolve, reject) => {
//         const cb = (result?: R) => {
//           if (result) {
//             // We have a result
//             resolve(result);
//           } else {
//             // We don't have a result
//             (resolve as any)();
//           }
//         }
//         fn(cb, reject, options);
//       });
//     } else {
//       // We don't have options
//       return new Promise((resolve, reject) => {
//         const cb = (result?: R) => {
//           if (result) {
//             // We have a result
//             resolve(result);
//           } else {
//             // We don't have a result
//             (resolve as any)();
//           }
//         }
//         (fn as (ScapFnNoOptNoRet | ScapFnNoOpt<R>))(cb, reject);
//       });
//     }
//   };
// };

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
