import { Component, createSignal, onMount, Show } from "solid-js";
import { useNavigate, useSearchParams } from "@solidjs/router";

import { arrayBufferToBase64 } from "../utils";

import "./signup.scss";

const domain = "localhost";

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

const baseUrl = "http://localhost:4000";
const origin = "http://localhost:3000";

const SignUp: Component = () => {
  const navigate = useNavigate();

  const [isMounted, setIsMounted] = createSignal<boolean>(false);
  const [status, setStatus] = createSignal<string>("Ready");
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);

  const [searchParams, setSearchParams] = useSearchParams<SignUpQueryParams>();

  const encoder = new TextEncoder(); // Creates a new encoder

  const { email, signup_id, challenge } = searchParams;

  if (!email || !signup_id || !challenge) {
    setStatus("Invalid query params");
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
          name: "Castmill AB", // your company name
        },
        user: {
          id: encoder.encode(signup_id!),
          name: email!,
          displayName: email!,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -8 }, // Ed25519
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        challenge: encoder.encode(searchParams.challenge!),
        authenticatorSelection: {
          userVerification: "required",
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
      alert("Could not create credential");
      return;
    }

    const publicKeyCredential = credential as PublicKeyCredential;
    const authAttestationResponse =
      publicKeyCredential.response as AuthenticatorAttestationResponse;
    const publicKey = authAttestationResponse.getPublicKey();
    if (!publicKey) {
      alert("Could not get public key");
      return;
    }

    const clientDataJSON = new TextDecoder().decode(
      authAttestationResponse.clientDataJSON
    );
    const clientData = JSON.parse(clientDataJSON);

    console.log({ clientData, authAttestationResponse, publicKey });

    if (
      clientData.type !== "webauthn.create" ||
      ("crossOrigin" in clientData && clientData.crossOrigin) ||
      clientData.origin !== origin
    ) {
      alert("Invalid credential");
      return;
    }

    // Send the credential to the server to be stored
    const result = await fetch(`${baseUrl}/signups/${signup_id}/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        challenge,
        credential_id: credential.id,
        public_key_spki: arrayBufferToBase64(publicKey),
        raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
        client_data_json: new Uint8Array(
          authAttestationResponse.clientDataJSON
        ),
      }),
      credentials: "include", // Essential for including cookies
    });

    if (!result.ok) {
      alert("Something went wrong when signing up, contact support.");
    } else {
      navigate("/");
    }
  }

  onMount(async () => {
    if (!(await checkPasskeysSupport())) {
      setStatus("Passkey not supported");
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
          <h2>Sign up</h2>

          <input type="text" placeholder={email} value={email} disabled />
          <button
            class="login-button"
            onClick={signupWithPasskey}
            disabled={!supportsPasskeys()}
          >
            Continue with Passkey
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
              We care about your privacy. Read our{" "}
              <a href="#">Privacy Policy</a>.
            </p>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default SignUp;
