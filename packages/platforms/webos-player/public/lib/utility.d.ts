// Utility.d.ts

interface Utility {
  createToast(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: CreateToastOptions
  ): void;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

interface CreateToastOptions {
  msg: string;
}

declare const Utility: {
  new (): Utility;
};
