import { describe, expect, it } from 'vitest';
import { getLegacyParentOrigin, getLegacyPlatform } from './player-frame';

describe('getLegacyParentOrigin', () => {
  it('uses the parent window origin from document.referrer', () => {
    expect(
      getLegacyParentOrigin(
        'https://wrapper.castmill.test/player?device=42',
        'https://server.castmill.test'
      )
    ).toBe('https://wrapper.castmill.test');
  });

  describe('getLegacyPlatform', () => {
    it('identifies both spellings used by WebOS user agents', () => {
      expect(getLegacyPlatform('Mozilla/5.0 (Web0S; Linux/SmartTV)')).toBe(
        'webos'
      );
      expect(getLegacyPlatform('Mozilla/5.0 (webOS; Linux/SmartTV)')).toBe(
        'webos'
      );
    });

    it('preserves the existing Android and Electron integrations', () => {
      expect(getLegacyPlatform('Mozilla/5.0 (Android 5.1)')).toBe('android');
      expect(getLegacyPlatform('Mozilla/5.0 Electron/29')).toBe('electron');
    });
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
