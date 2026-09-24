export const listenForLegacyConsoleToggle = (
  onToggle: () => void,
  allowedOrigin = window.location.origin,
  allowFileWrapper = false
): (() => void) => {
  const report = (message: string) => {
    console.log(`[legacy debug] ${message}`);
    try {
      if (window.parent !== window) {
        window.parent.postMessage(`[legacy debug] ${message}`, '*');
      }
    } catch (error) {
      console.warn('[legacy debug] Failed to report status to host', error);
    }
  };

  const onMessage = (event: MessageEvent) => {
    if (event.data !== 'console') {
      return;
    }

    const origin = typeof event.origin === 'string' ? event.origin : '';
    const isFileWrapperOrigin = origin === 'null' || origin.startsWith('file:');
    const isFileWrapper =
      (allowFileWrapper || allowedOrigin === 'null') && isFileWrapperOrigin;
    const isExpectedParent =
      event.source === window.parent ||
      // Legacy WebOS does not always preserve WindowProxy identity for local
      // file-wrapper messages, despite delivering the message to its iframe.
      (allowFileWrapper && isFileWrapperOrigin);
    const isExpectedOrigin = origin === allowedOrigin || isFileWrapper;
    if (isExpectedParent && isExpectedOrigin) {
      report(
        `Accepted console message (origin=${origin || 'missing'}, sourceIsParent=${String(
          event.source === window.parent
        )})`
      );
      onToggle();
      return;
    }

    report(
      `Ignored console message (origin=${origin || 'missing'}, sourceIsParent=${String(
        event.source === window.parent
      )}, expectedOrigin=${allowedOrigin})`
    );
  };

  window.addEventListener('message', onMessage);
  report(
    `Listener registered (allowedOrigin=${allowedOrigin}, allowFileWrapper=${String(
      allowFileWrapper
    )})`
  );

  return () => {
    window.removeEventListener('message', onMessage);
  };
};
