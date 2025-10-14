import { describe, it, expect } from 'vitest';
import { buildRedirectUrl } from './protected-route';

describe('buildRedirectUrl', () => {
  it('returns login url with encoded pathname when not root', () => {
    expect(buildRedirectUrl('/invite', '')).toBe('/login?redirectTo=%2Finvite');
  });

  it('preserves query parameters when provided', () => {
    expect(buildRedirectUrl('/invite', '?token=abc123')).toBe(
      '/login?redirectTo=%2Finvite%3Ftoken%3Dabc123'
    );
  });

  it('redirects to bare login when destination is root', () => {
    expect(buildRedirectUrl('/', '')).toBe('/login');
  });
});
