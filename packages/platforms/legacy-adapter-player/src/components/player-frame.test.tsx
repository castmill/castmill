import { describe, expect, it } from 'vitest';
import { getLegacyParentOrigin } from './player-frame';

describe('getLegacyParentOrigin', () => {
  it('uses the parent window origin from document.referrer', () => {
    expect(
      getLegacyParentOrigin(
        'https://wrapper.castmill.test/player?device=42',
        'https://server.castmill.test'
      )
    ).toBe('https://wrapper.castmill.test');
  });

  it('accepts opaque file origins reported as null', () => {
    expect(
      getLegacyParentOrigin(
        'file:///android_asset/www/index.html',
        'https://server.castmill.test'
      )
    ).toBe('null');
  });

  it('falls back to the current location origin when referrer is unavailable', () => {
    expect(getLegacyParentOrigin('', 'https://server.castmill.test')).toBe(
      'https://server.castmill.test'
    );
  });
});
