import { Component, createSignal, onMount, Show } from 'solid-js';
import { useNavigate, useSearchParams } from '@solidjs/router';
import { useToast } from '@castmill/ui-common';

import { arrayBufferToBase64, base64URLToArrayBuffer } from '../utils';

import './signup.scss';

import { baseUrl, origin, domain } from '../../env';
import { useI18n } from '../../i18n';

/**
 * Sign Up Component.
 *
 * This component is responsible for handling the sign up process.
 * It requires an existing "SignUp" row in the database that matches
 * the email and the challenege. This guarantees that the email is
 * verified and controlled by the user. The challenge is a random
 * string that is sent to the user's email and is used to verify
 * that the user has access to the email.
 *
 */

interface SignUpQueryParams {
  [key: string]: string;
  signup_id: string;
  email: string;
  challenge: string;
}

const SignUp: Component = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const toast = useToast();

  const [isMounted, setIsMounted] = createSignal<boolean>(false);
  const [status, setStatus] = createSignal<string>('Ready');
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);

  const [searchParams, setSearchParams] = useSearchParams<SignUpQueryParams>();

  const encoder = new TextEncoder(); // Creates a new encoder

  const { email, signup_id, challenge } = searchParams;

  if (!email || !signup_id || !challenge) {
    setStatus('Invalid query params');
  }

  async function checkPasskeysSupport() {
    if (
      !window.PublicKeyCredential ||
      !PublicKeyCredential.isConditionalMediationAvailable
    ) {
      return false;
    }
    const [conditional, userVerifiying] = await Promise.all([
      PublicKeyCredential.isConditionalMediationAvailable(),
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
    ]);
    return conditional && userVerifiying;
  }

  async function signupWithPasskey() {
    const createOptions: CredentialCreationOptions = {
      publicKey: {
        // rp -> Relying Party
        rp: {
          id: domain, // your domain (should be sent from the server I guess)
          name: 'Castmill AB', // your company name
        },
        user: {
          id: encoder.encode(signup_id!),
          name: email!,
          displayName: email!,
        },
        pubKeyCredParams: [
          { type: 'public-key', alg: -8 }, // Ed25519
          { type: 'public-key', alg: -7 }, // ES256
          { type: 'public-key', alg: -257 }, // RS256
        ],
        challenge: base64URLToArrayBuffer(searchParams.challenge!),
        authenticatorSelection: {
          userVerification: 'required',
          requireResidentKey: true,
        },
        /*
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          requireResidentKey: true,
        },
        */
      },
    };

    const credential = await navigator.credentials.create(createOptions);
    if (!credential) {
      toast.error(t('signup.errors.couldNotCreateCredential'));
      return;
    }

    const publicKeyCredential = credential as PublicKeyCredential;
    const authAttestationResponse =
      publicKeyCredential.response as AuthenticatorAttestationResponse;
    const publicKey = authAttestationResponse.getPublicKey();
    if (!publicKey) {
      toast.error(t('signup.errors.couldNotGetPublicKey'));
      return;
    }

    const clientDataJSON = new TextDecoder().decode(
      authAttestationResponse.clientDataJSON
    );
    const clientData = JSON.parse(clientDataJSON);

    console.log({ clientData, authAttestationResponse, publicKey });

    if (
      clientData.type !== 'webauthn.create' ||
      ('crossOrigin' in clientData && clientData.crossOrigin) ||
      clientData.origin !== origin
    ) {
      toast.error(t('signup.errors.invalidCredential'));
      return;
    }

    // Send the credential to the server to be stored
    const result = await fetch(`${baseUrl}/signups/${signup_id}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        challenge,
        credential_id: credential.id,
        public_key_spki: arrayBufferToBase64(publicKey),
        raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
        client_data_json: clientDataJSON,
      }),
      credentials: 'include', // Essential for including cookies
    });

    if (!result.ok) {
      toast.error(
        t('signup.errors.signupFailed', { error: result.statusText })
      );
    } else {
      toast.success('Account created successfully!');
      navigate('/');
    }
  }

  onMount(async () => {
    if (!(await checkPasskeysSupport())) {
      setStatus('Passkey not supported');
      return;
    } else {
      setSupportsPasskeys(true);
    }
    setIsMounted(true);
  });

  return (
    <Show when={isMounted()}>
      <div class="castmill-signup">
        <div class="login-box">
          <h2>{t('signup.title')}</h2>

          <input type="text" placeholder={email} value={email} disabled />
          <button
            class="login-button"
            onClick={signupWithPasskey}
            disabled={!supportsPasskeys()}
          >
            {t('signup.continueWithPasskey')}
          </button>

          <p class="status">Status: {status()}</p>
          <Show when={!supportsPasskeys()}>
            <p class="warn">
              Your browser does not support Passkeys. Link here with more
              info...
            </p>
          </Show>

          <div class="privacy">
            <p>
              We care about your privacy. Read our{' '}
              <a href="#">{t('signup.privacyPolicy')}</a>.
            </p>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default SignUp;
