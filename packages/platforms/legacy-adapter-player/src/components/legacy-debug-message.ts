export const listenForLegacyConsoleToggle = (
  onToggle: () => void
): (() => void) => {
  const onMessage = (event: MessageEvent) => {
    if (event.source === window.parent && event.data === 'console') {
      onToggle();
    }
  };

  window.addEventListener('message', onMessage);

  return () => {
    window.removeEventListener('message', onMessage);
  };
};
