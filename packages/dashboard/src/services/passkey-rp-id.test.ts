import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPasskeyRpId,
  requestPasskeyCredential,
  resetPasskeyRpId,
} from './passkey-rp-id';

const jsonResponse = (body: unknown, ok = true) =>
  Promise.resolve({ ok, json: () => Promise.resolve(body) } as Response);

describe('getPasskeyRpId', () => {
  beforeEach(() => {
    resetPasskeyRpId();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the passkey RP ID from the public network settings, once', async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ passkey_rp_id: 'net-abc.castmill.net' })
    );
    vi.stubGlobal('fetch', fetchMock);

    expect(await getPasskeyRpId()).toBe('net-abc.castmill.net');
    expect(await getPasskeyRpId()).toBe('net-abc.castmill.net');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/dashboard/network/public-settings'),
      { method: 'GET' }
    );
  });

  it('requests a credential for the network RP ID by default', async () => {
    const fetchMock = vi.fn(() =>
      jsonResponse({ passkey_rp_id: 'net-abc.castmill.net' })
    );
    const getCredential = vi.fn().mockResolvedValue({ id: 'credential' });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('navigator', { credentials: { get: getCredential } });

    const challenge = new ArrayBuffer(32);
    await requestPasskeyCredential(challenge);

    expect(getCredential).toHaveBeenCalledWith({
      publicKey: {
        rpId: 'net-abc.castmill.net',
        challenge,
      },
    });
  });

  it('can explicitly request a credential for the current domain', async () => {
    const getCredential = vi.fn().mockResolvedValue({ id: 'credential' });
    vi.stubGlobal('navigator', { credentials: { get: getCredential } });

    const challenge = new ArrayBuffer(32);
    await requestPasskeyCredential(challenge, 'current-domain');

    expect(getCredential).toHaveBeenCalledWith({
      publicKey: {
        rpId: window.location.hostname,
        challenge,
      },
    });
  });

  it.each([
    ['the settings have no RP ID', () => jsonResponse({ name: 'Castmill' })],
    ['the network is not found', () => jsonResponse({}, false)],
    ['the request fails', () => Promise.reject(new Error('offline'))],
  ])(
    'falls back to the hostname when %s, without caching it',
    async (_case, fetchImpl) => {
      const fetchMock = vi.fn(fetchImpl);
      vi.stubGlobal('fetch', fetchMock);

      expect(await getPasskeyRpId()).toBe(window.location.hostname);
      expect(await getPasskeyRpId()).toBe(window.location.hostname);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  );
});
