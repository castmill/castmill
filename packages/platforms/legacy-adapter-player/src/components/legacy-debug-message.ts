export const listenForLegacyConsoleToggle = (
  onToggle: () => void,
  allowedOrigin = window.location.origin
): (() => void) => {
  const onMessage = (event: MessageEvent) => {
    if (
      event.source === window.parent &&
      event.data === 'console' &&
      event.origin === allowedOrigin
    ) {
      onToggle();
    }
  };

  window.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('message', onMessage);
  };
};
