import { describe, expect, it } from 'vitest';
import { getLegacyBaseUrl } from './base-url';

describe('getLegacyBaseUrl', () => {
  it('uses the serving origin for the Phoenix-hosted legacy player', () => {
    expect(
      getLegacyBaseUrl(
        {
          origin: 'http://192.168.68.57:4000',
          pathname: '/legacy',
        },
        'https://api.castmill.dev'
      )
    ).toBe('http://192.168.68.57:4000');
  });

  it('uses the configured API for the standalone development server', () => {
    expect(
      getLegacyBaseUrl(
        {
          origin: 'http://localhost:3003',
          pathname: '/',
        },
        'http://192.168.68.57:4000'
      )
    ).toBe('http://192.168.68.57:4000');
  });
});
