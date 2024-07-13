// Security.d.ts

interface Security {
  existServerCertificate(
    successCallback: (cbObject: ExistServerCertificateResponse) => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: ExistServerCertificateOptions
  ): void;
  registerServerCertificate(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: RegisterServerCertificateOptions
  ): void;
  unregisterServerCertificate(
    successCallback: () => void,
    errorCallback: (cbObject: ErrorResponse) => void,
    options: UnregisterServerCertificateOptions
  ): void;
}

interface ExistServerCertificateOptions {
  userName: string;
  password: string;
}

interface ExistServerCertificateResponse {
  userName: string;
  exist: boolean;
}

interface RegisterServerCertificateOptions {
  userName: string;
  password: string;
  certificate: string;
}

interface UnregisterServerCertificateOptions {
  userName: string;
  password: string;
}

interface ErrorResponse {
  errorCode: number;
  errorText: string;
}

declare const Security: {
  new (): Security;
};
