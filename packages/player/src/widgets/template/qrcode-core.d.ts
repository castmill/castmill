declare module 'qrcode/lib/core/qrcode' {
  export interface QRCodeBitMatrix {
    size: number;
    data: Uint8Array;
    get(row: number, col: number): number | boolean;
  }

  export function create(
    text: string,
    options?: { errorCorrectionLevel?: string }
  ): { version: number; modules: QRCodeBitMatrix };
}
