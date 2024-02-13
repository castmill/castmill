export const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var len = bytes.byteLength;
  for (var i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export const base64ToArrayBuffer = (b64: string) => {
  const bin = window.atob(b64);

  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

export const base64URLToArrayBuffer = (b64: string) => {
  const converted = b64.replace(/[-_]/g, (c) => c === "-" ? "+" : "/");
  return base64ToArrayBuffer(converted);
}
