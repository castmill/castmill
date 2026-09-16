import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenForLegacyConsoleToggle } from './legacy-debug-message';

describe('listenForLegacyConsoleToggle', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('accepts only the exact console message from the parent window', () => {
    const onToggle = vi.fn();
    cleanups.push(listenForLegacyConsoleToggle(onToggle));

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        source: window.parent,
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { action: 'console' },
        source: window.parent,
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'Console',
        source: window.parent,
      })
    );

    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        source: iframe.contentWindow,
      })
    );
    iframe.remove();

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('removes the message listener during cleanup', () => {
    const onToggle = vi.fn();
    const stopListening = listenForLegacyConsoleToggle(onToggle);

    stopListening();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        source: window.parent,
      })
    );

    expect(onToggle).not.toHaveBeenCalled();
  });
});
