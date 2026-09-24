import { afterEach, describe, expect, it, vi } from 'vitest';
import { listenForLegacyConsoleToggle } from './legacy-debug-message';

describe('listenForLegacyConsoleToggle', () => {
  const cleanups: Array<() => void> = [];

  afterEach(() => {
    cleanups.splice(0).forEach((cleanup) => cleanup());
  });

  it('accepts only the exact console message from the parent window', () => {
    const onToggle = vi.fn();
    cleanups.push(
      listenForLegacyConsoleToggle(onToggle, 'https://castmill.example')
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        origin: 'https://castmill.example',
        source: window.parent,
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: { action: 'console' },
        origin: 'https://castmill.example',
        source: window.parent,
      })
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'Console',
        origin: 'https://castmill.example',
        source: window.parent,
      })
    );

    const iframe = document.createElement('iframe');
    document.body.append(iframe);
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        origin: 'https://castmill.example',
        source: iframe.contentWindow,
      })
    );
    iframe.remove();

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('ignores console messages from unexpected origins', () => {
    const onToggle = vi.fn();
    cleanups.push(
      listenForLegacyConsoleToggle(onToggle, 'https://castmill.example')
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        origin: 'https://other.example',
        source: window.parent,
      })
    );

    expect(onToggle).not.toHaveBeenCalled();
  });

  it.each(['null', 'file://'])(
    'accepts the Android file wrapper origin serialization %s',
    (origin) => {
      const onToggle = vi.fn();
      cleanups.push(listenForLegacyConsoleToggle(onToggle, 'null'));

      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'console',
          origin,
          source: window.parent,
        })
      );

      expect(onToggle).toHaveBeenCalledOnce();
    }
  );

  it('does not trust file origins when the expected parent has a network origin', () => {
    const onToggle = vi.fn();
    cleanups.push(
      listenForLegacyConsoleToggle(onToggle, 'https://castmill.example')
    );

    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        origin: 'null',
        source: window.parent,
      })
    );

    expect(onToggle).not.toHaveBeenCalled();
  });

  it.each(['null', 'file://'])(
    'accepts Android wrapper origin %s when Crosswalk omits the file referrer',
    (origin) => {
      const onToggle = vi.fn();
      cleanups.push(
        listenForLegacyConsoleToggle(onToggle, 'http://castmill.example', true)
      );

      window.dispatchEvent(
        new MessageEvent('message', {
          data: 'console',
          origin,
          source: window.parent,
        })
      );

      expect(onToggle).toHaveBeenCalledOnce();
    }
  );

  it('removes the message listener during cleanup', () => {
    const onToggle = vi.fn();
    const stopListening = listenForLegacyConsoleToggle(
      onToggle,
      'https://castmill.example'
    );

    stopListening();
    window.dispatchEvent(
      new MessageEvent('message', {
        data: 'console',
        origin: 'https://castmill.example',
        source: window.parent,
      })
    );

    expect(onToggle).not.toHaveBeenCalled();
  });
});
