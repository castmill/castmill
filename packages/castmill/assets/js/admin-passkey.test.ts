import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import {
  AdminPasskey,
  decodeBase64Url,
  encodeBase64Url,
  useAdminPasskey,
} from './admin-passkey';

class TestCredential {
  rawId = new Uint8Array([1, 2, 255]).buffer;
  response = {
    clientDataJSON: new Uint8Array([3]).buffer,
    authenticatorData: new Uint8Array([4]).buffer,
    signature: new Uint8Array([5]).buffer,
    userHandle: new TextEncoder().encode('root').buffer,
    attestationObject: new Uint8Array([6]).buffer,
  };
}

const request = vi.fn();
const get = vi.fn();
const create = vi.fn();
const navigate = vi.fn();

function form(action = 'login'): HTMLFormElement {
  document.body.innerHTML = `
    <form data-action="${action}">
      <input name="name" value="Backup key" />
      <button type="submit">Continue</button>
      <p data-passkey-error></p>
    </form>`;
  return document.querySelector('form')!;
}

function respond(data: object, ok = true) {
  request.mockResolvedValueOnce({ ok, json: async () => data });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('PublicKeyCredential', TestCredential);
  vi.stubGlobal('isSecureContext', true);
  vi.stubGlobal('fetch', request);
  vi.stubGlobal('location', { assign: navigate });
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { get, create },
  });
  document.head.innerHTML = '<meta name="csrf-token" content="csrf">';
  get.mockResolvedValue(new TestCredential());
  create.mockResolvedValue(new TestCredential());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('admin passkeys', () => {
  it('round-trips base64url bytes without padding', () => {
    const bytes = new Uint8Array([0, 250, 255, 128]);
    expect(decodeBase64Url(encodeBase64Url(bytes.buffer))).toEqual(bytes);
  });

  it('uses discoverable, user-verified credentials and CSRF-protected requests', async () => {
    respond({ challenge: 'AQI', rpId: 'localhost' });
    respond({ redirect: '/admin' });
    await useAdminPasskey(form());
    expect(get).toHaveBeenCalledWith({
      publicKey: {
        challenge: new Uint8Array([1, 2]),
        rpId: 'localhost',
        userVerification: 'required',
        timeout: 60_000,
      },
    });
    expect(request.mock.calls[0][1].headers['x-csrf-token']).toBe('csrf');
    expect(request.mock.calls[0][1].credentials).toBe('same-origin');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      remember_me: 'false',
      id: 'AQL_',
      client_data: 'Aw',
      authenticator_data: 'BA',
      signature: 'BQ',
      user_handle: 'cm9vdA',
    });
    expect(navigate).toHaveBeenCalledWith('/admin');
  });

  it('registers a discoverable key with UV and a server-verified attestation', async () => {
    respond({
      challenge: 'AQI',
      user: { id: 'cm9vdA', name: 'root@example.com', displayName: 'Root' },
      rp: { id: 'localhost', name: 'Castmill Admin' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      excludeCredentials: [{ type: 'public-key', id: 'AQL_' }],
    });
    respond({ redirect: '/admin/passkeys' });
    await useAdminPasskey(form('register'));
    const options = create.mock.calls[0][0].publicKey;
    expect(Array.from(options.user.id)).toEqual([114, 111, 111, 116]);
    expect(options.excludeCredentials[0].id).toEqual(
      new Uint8Array([1, 2, 255])
    );
    expect(options.authenticatorSelection).toEqual({
      residentKey: 'required',
      userVerification: 'required',
    });
    expect(options.attestation).toBe('none');
    expect(JSON.parse(request.mock.calls[1][1].body)).toEqual({
      name: 'Backup key',
      client_data: 'Aw',
      attestation_object: 'Bg',
    });
  });

  it('rejects insecure or unsupported browsers explicitly', async () => {
    vi.stubGlobal('isSecureContext', false);
    await expect(useAdminPasskey(form())).rejects.toThrow('HTTPS');
    expect(request).not.toHaveBeenCalled();
  });

  it('rejects missing CSRF tokens, names and invalid registration options', async () => {
    document.head.innerHTML = '';
    await expect(useAdminPasskey(form())).rejects.toThrow('security token');
    document.head.innerHTML = '<meta name="csrf-token" content="csrf">';
    const empty = form('register');
    empty.querySelector('input')!.value = ' ';
    await expect(useAdminPasskey(empty)).rejects.toThrow('Enter a name');
    respond({ challenge: 'AQI' });
    await expect(useAdminPasskey(form('register'))).rejects.toThrow(
      'Invalid passkey options'
    );
  });

  it('does not navigate on failed verification or unexpected redirects', async () => {
    respond({ challenge: 'AQI' });
    respond({ error: 'Unable to verify passkey' }, false);
    await expect(useAdminPasskey(form())).rejects.toThrow('Unable to verify');
    respond({ challenge: 'AQI' });
    respond({ redirect: 'https://evil.example' });
    await expect(useAdminPasskey(form())).rejects.toThrow('incomplete');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reports absent credentials', async () => {
    respond({ challenge: 'AQI' });
    get.mockResolvedValueOnce(null);
    await expect(useAdminPasskey(form())).rejects.toThrow(
      'No passkey was selected'
    );
  });

  it('sends remember-me and handles absent user handles', async () => {
    const el = form();
    el.insertAdjacentHTML(
      'beforeend',
      '<input name="remember_me" type="checkbox" checked />'
    );
    const credential = new TestCredential();
    Object.defineProperty(credential.response, 'userHandle', { value: null });
    get.mockResolvedValueOnce(credential);
    respond({ challenge: 'AQI' });
    respond({ redirect: '/admin' });
    await useAdminPasskey(el);
    expect(JSON.parse(request.mock.calls[1][1].body).remember_me).toBe('true');
    expect(JSON.parse(request.mock.calls[1][1].body).user_handle).toBe(null);
  });

  it('reports cancelled registration and network errors', async () => {
    respond({
      challenge: 'AQI',
      user: { id: 'cm9vdA', name: 'Root', displayName: 'Root' },
      rp: { id: 'localhost', name: 'Admin' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
    });
    create.mockResolvedValueOnce(null);
    await expect(useAdminPasskey(form('register'))).rejects.toThrow(
      'No passkey was created'
    );
    respond({}, false);
    await expect(useAdminPasskey(form())).rejects.toThrow(
      'Passkey request failed'
    );
  });

  it('reports an unknown action', async () => {
    await expect(useAdminPasskey(form('unknown'))).rejects.toThrow('Unknown');
  });

  it('shows cancellation feedback, disables duplicate submissions, and detaches its listener', async () => {
    const el = form();
    const hook = {
      el,
      submit: undefined as ((event: Event) => Promise<void>) | undefined,
    };
    AdminPasskey.mounted.call(hook);
    const button = el.querySelector('button')!;
    respond({ challenge: 'AQI' });
    get.mockRejectedValueOnce(new DOMException('cancelled', 'NotAllowedError'));
    const pending = hook.submit!(new Event('submit'));
    expect(button.disabled).toBe(true);
    await hook.submit!(new Event('submit'));
    await pending;
    expect(button.disabled).toBe(false);
    expect(el.querySelector('[data-passkey-error]')!.textContent).toContain(
      'cancelled or timed out'
    );
    expect(request).toHaveBeenCalledTimes(1);
    AdminPasskey.destroyed.call(hook);
    const event = new Event('submit', { cancelable: true });
    el.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('shows other failures and reenables retry', async () => {
    const el = form('unknown');
    const hook = {
      el,
      submit: undefined as ((event: Event) => Promise<void>) | undefined,
    };
    AdminPasskey.mounted.call(hook);
    await hook.submit!(new Event('submit'));
    expect(el.querySelector('[data-passkey-error]')!.textContent).toBe(
      'Unknown passkey action.'
    );
    expect(el.querySelector('button')!.disabled).toBe(false);
    AdminPasskey.destroyed.call(hook);
  });
});
