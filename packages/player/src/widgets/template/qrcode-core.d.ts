declare module 'qrcode/lib/core/qrcode' {
  export interface QRCodeBitMatrix {
    size: number;
    data: Uint8Array;
    get(row: number, col: number): number | boolean;
  }

  export function create(
    text: string | Array<{ data: Uint8Array; mode: 'byte' }>,
    options?: { errorCorrectionLevel?: string }
  ): { version: number; modules: QRCodeBitMatrix };
}
