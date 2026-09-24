export const listenForLegacyConsoleToggle = (
  onToggle: () => void,
  allowedOrigin = window.location.origin,
  allowFileWrapper = false
): (() => void) => {
  const onMessage = (event: MessageEvent) => {
    const isFileWrapper =
      (allowFileWrapper || allowedOrigin === 'null') &&
      (event.origin === 'null' || event.origin === 'file://');
    if (
      event.source === window.parent &&
      event.data === 'console' &&
      (event.origin === allowedOrigin || isFileWrapper)
    ) {
      onToggle();
    }
  };

  window.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('message', onMessage);
  };
};
