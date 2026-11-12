type PasskeyOptions = {
  challenge: string;
  rpId?: string;
  user?: { id: string; name: string; displayName: string };
  rp?: PublicKeyCredentialRpEntity;
  pubKeyCredParams?: PublicKeyCredentialParameters[];
  excludeCredentials?: { type: 'public-key'; id: string }[];
};

type PasskeyResult = PasskeyOptions & { error?: string; redirect?: string };

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export function encodeBase64Url(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = '';
  bytes.forEach((byte) => (binary += String.fromCharCode(byte)));
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function request(
  path: string,
  body: Record<string, unknown> = {}
): Promise<PasskeyResult> {
  const csrf = document.querySelector<HTMLMetaElement>(
    "meta[name='csrf-token']"
  )?.content;
  if (!csrf)
    throw new Error('Missing security token. Reload the page and try again.');

  const response = await fetch(`/admin/passkeys/${path}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrf },
    body: JSON.stringify(body),
  });
  const data: PasskeyResult = await response.json();
  if (!response.ok)
    throw new Error(data.error || 'Passkey request failed. Please try again.');
  return data;
}

export async function useAdminPasskey(form: HTMLFormElement): Promise<void> {
  if (
    !window.isSecureContext ||
    !window.PublicKeyCredential ||
    !navigator.credentials
  ) {
    throw new Error(
      'Passkeys require a supported browser and HTTPS (or localhost).'
    );
  }

  const action = form.dataset.action;
  let result: PasskeyResult;
  if (action === 'login') {
    const options = await request('login/options');
    const credential = await navigator.credentials.get({
      publicKey: {
        challenge: decodeBase64Url(options.challenge),
        rpId: options.rpId,
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    if (!(credential instanceof PublicKeyCredential))
      throw new Error('No passkey was selected.');
    const response = credential.response as AuthenticatorAssertionResponse;
    result = await request('login', {
      remember_me: form.querySelector<HTMLInputElement>('[name="remember_me"]')
        ?.checked
        ? 'true'
        : 'false',
      id: encodeBase64Url(credential.rawId),
      client_data: encodeBase64Url(response.clientDataJSON),
      authenticator_data: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      user_handle: response.userHandle
        ? encodeBase64Url(response.userHandle)
        : null,
    });
  } else if (action === 'register') {
    const name = form
      .querySelector<HTMLInputElement>('[name="name"]')
      ?.value.trim();
    if (!name) throw new Error('Enter a name for your passkey.');
    const options = await request('register/options');
    if (!options.user || !options.rp || !options.pubKeyCredParams) {
      throw new Error(
        'Invalid passkey options. Reload the page and try again.'
      );
    }
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: decodeBase64Url(options.challenge),
        user: { ...options.user, id: decodeBase64Url(options.user.id) },
        rp: options.rp,
        pubKeyCredParams: options.pubKeyCredParams,
        excludeCredentials: options.excludeCredentials?.map((key) => ({
          ...key,
          id: decodeBase64Url(key.id),
        })),
        authenticatorSelection: {
          residentKey: 'required',
          userVerification: 'required',
        },
        attestation: 'none',
        timeout: 60_000,
      },
    });
    if (!(credential instanceof PublicKeyCredential))
      throw new Error('No passkey was created.');
    const response = credential.response as AuthenticatorAttestationResponse;
    result = await request('register', {
      name,
      client_data: encodeBase64Url(response.clientDataJSON),
      attestation_object: encodeBase64Url(response.attestationObject),
    });
  } else {
    throw new Error('Unknown passkey action.');
  }

  if (
    result.redirect?.startsWith('/admin') &&
    !result.redirect.startsWith('//')
  ) {
    window.location.assign(result.redirect);
  } else {
    throw new Error('Passkey response was incomplete. Please sign in again.');
  }
}

type PasskeyHook = {
  el: HTMLFormElement;
  submit?: (event: Event) => Promise<void>;
};

export const AdminPasskey = {
  mounted(this: PasskeyHook) {
    this.submit = async (event: Event) => {
      event.preventDefault();
      const button = this.el.querySelector<HTMLButtonElement>(
        'button[type="submit"]'
      );
      const error = this.el.querySelector<HTMLElement>('[data-passkey-error]');
      if (button?.disabled) return;
      if (button) button.disabled = true;
      if (error) error.textContent = '';
      try {
        await useAdminPasskey(this.el);
      } catch (reason) {
        if (error) {
          error.textContent =
            reason instanceof DOMException && reason.name === 'NotAllowedError'
              ? 'Passkey request cancelled or timed out. Please try again.'
              : reason instanceof Error
                ? reason.message
                : 'Passkey request failed. Please try again.';
        }
      } finally {
        if (button) button.disabled = false;
      }
    };
    this.el.addEventListener('submit', this.submit);
  },
  destroyed(this: PasskeyHook) {
    if (this.submit) this.el.removeEventListener('submit', this.submit);
  },
};
