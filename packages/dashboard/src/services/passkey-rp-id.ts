import { baseUrl, domain } from '../env';

let cached: Promise<string> | undefined;

/**
 * The relying party ID (domain) to create and use passkeys with.
 *
 * All passkeys of a network belong to its primary domain, also when the
 * dashboard is opened on one of the network's custom domains (WebAuthn
 * Related Origin Requests), so adding a custom domain keeps them working. The
 * backend returns it in the public network settings; without it the current
 * hostname is used, as before.
 */
export const getPasskeyRpId = (): Promise<string> => {
  if (!cached) {
    const request = fetch(`${baseUrl}/dashboard/network/public-settings`, {
      method: 'GET',
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((settings) => {
        const rpId = settings?.passkey_rp_id;
        if (typeof rpId === 'string' && rpId) return rpId;
        cached = undefined;
        return domain;
      })
      .catch(() => {
        cached = undefined;
        return domain;
      });

    cached = request;
  }

  return cached;
};

/** Forgets the cached relying party ID (for tests). */
export const resetPasskeyRpId = () => {
  cached = undefined;
};
