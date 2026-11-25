import { describe, expect, it } from 'vitest';
import { getLegacyBaseUrl, getServedServerUrl } from './base-url';

const documentWithMeta = (content: string | null): Document => {
  const doc = document.implementation.createHTMLDocument('adapter');
  if (content !== null) {
    const meta = doc.createElement('meta');
    meta.setAttribute('name', 'castmill-server-url');
    meta.setAttribute('content', content);
    doc.head.appendChild(meta);
  }
  return doc;
};

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

  it('uses the server declared by a page served from another origin', () => {
    expect(
      getLegacyBaseUrl(
        { origin: 'https://player.example.com', pathname: '/' },
        undefined,
        'https://castmill.example.com'
      )
    ).toBe('https://castmill.example.com');
  });

  it('prefers the build-time API over the declared server', () => {
    expect(
      getLegacyBaseUrl(
        { origin: 'https://player.example.com', pathname: '/' },
        'http://192.168.68.57:4000',
        'https://castmill.example.com'
      )
    ).toBe('http://192.168.68.57:4000');
  });

  it('keeps the serving origin under /legacy', () => {
    expect(
      getLegacyBaseUrl(
        { origin: 'https://castmill.example.com', pathname: '/legacy/' },
        undefined,
        'https://other.example.com'
      )
    ).toBe('https://castmill.example.com');
  });
});

describe('getServedServerUrl', () => {
  it('reads the declared server without a trailing slash', () => {
    expect(
      getServedServerUrl(documentWithMeta(' https://castmill.example.com/ '))
    ).toBe('https://castmill.example.com');
  });

  it('ignores a missing, relative or non-HTTP server URL', () => {
    expect(getServedServerUrl(documentWithMeta(null))).toBeUndefined();
    expect(getServedServerUrl(documentWithMeta('/api'))).toBeUndefined();
    expect(
      getServedServerUrl(documentWithMeta('javascript:alert(1)'))
    ).toBeUndefined();
  });
});
