import { Component, createSignal, onMount, Show } from "solid-js";
import { arrayBufferToBase64, base64URLToArrayBuffer } from "../utils";

import "./login.scss";
import { resetSession, setAuthenticated } from "../auth";
import { useNavigate } from "@solidjs/router";
import SignUpEmailSent from "../signup/signup-email-sent";

const baseUrl = "http://localhost:4000";
const domain = "localhost";

console.log("ENV:", import.meta.env);

const encoder = new TextEncoder(); // Creates a new encoder

const Login: Component = () => {
  const [isMounted, setIsMounted] = createSignal<boolean>(false);
  const [loading, setLoading] = createSignal<boolean>(false);
  const [status, setStatus] = createSignal<string>("Ready");
  const [supportsPasskeys, setSupportsPasskeys] = createSignal<boolean>(false);
  const [email, setEmail] = createSignal<string>("");
  const [disabledSignUp, setDisabledSignUp] = createSignal<boolean>(true);
  const [showEmailSent, setShowEmailSent] = createSignal<boolean>(false);

  const navigate = useNavigate();

  resetSession();

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

  onMount(async () => {
    if (!(await checkPasskeysSupport())) {
      setStatus("Passkey not supported");
      return;
    } else {
      setSupportsPasskeys(true);
    }
    setIsMounted(true);
  });

  const loginWithPasskey = async (): Promise<void> => {
    try {
      setStatus("Authenticating...");

      const response = await fetch(`${baseUrl}/sessions/challenges`, {
        credentials: "include", // Essential for including cookies
      });
      if (!response.ok) {
        console.error("Failed to get challenge");
        setStatus("Authentication failed");
        return;
      }

      const { challenge } = (await response.json()) as { challenge: string };
      console.log("Challenge:", challenge);

      const publicKey: PublicKeyCredentialRequestOptions = {
        rpId: domain,
        challenge: base64URLToArrayBuffer(challenge),
      };

      const credential = await navigator.credentials.get({
        publicKey: publicKey,
      });

      if (!credential) {
        console.error("No credentials received");
        setStatus("Authentication failed");
        return;
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const authAssertionResponse =
        publicKeyCredential.response as AuthenticatorAssertionResponse;

      const clientDataJSON = new TextDecoder().decode(
        authAssertionResponse.clientDataJSON
      );

      const result = await fetch(`${baseUrl}/sessions/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          credential_id: publicKeyCredential.id,
          raw_id: arrayBufferToBase64(publicKeyCredential.rawId),
          client_data_json: clientDataJSON,
          authenticator_data: arrayBufferToBase64(
            authAssertionResponse.authenticatorData
          ),
          signature: arrayBufferToBase64(authAssertionResponse.signature),
          email,
          challenge,
        }),
        credentials: "include",
      });

      if (!result.ok) {
        console.error("Failed to authenticate");
        setStatus("Authentication failed");
        return;
      } else {
        setStatus("Authenticated");

        // Set the authenticated signal to true
        setAuthenticated(true);

        // Redirect to dashboard
        navigate("/");
      }
    } catch (error) {
      console.error("Authentication error:", error);
      setStatus("Authentication failed");
    }
  };

  const startSignupProcess = async (): Promise<void> => {
    // Send the email to the server to start the signup process
    // The server will send a challenge to the email with a link to the SignUp component
    setLoading(true);

    const result = await fetch(`${baseUrl}/signups`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({ email: email() }),
    });

    if (!result.ok) {
      setStatus("Failed to start signup process");
    } else {
      setStatus("Check your email for the signup link");
    }
    setLoading(false);
    setShowEmailSent(true);
  };

  const handleEmailChange = (event: Event) => {
    const target = event.target as HTMLInputElement; // Type assertion for target
    setEmail(target.value); // Update the email state with the input value

    if (isValidEmail()) {
      setDisabledSignUp(false);
    } else {
      setDisabledSignUp(true);
    }
  };

  // Check email has a valid format, using a regular expression
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isValidEmail = () => emailRegex.test(email());

  return (
    <Show when={isMounted()}>
      <div class="castmill-login">
        <Show when={loading()}>
          <div class="loading-overlay">Loading...</div>
        </Show>

        <div class="login-container">
          <div class="login-box">
            <Show when={!showEmailSent()} fallback={<SignUpEmailSent />}>
              <h2>Login</h2>

              <button
                class="signup-button"
                onClick={loginWithPasskey}
                disabled={!supportsPasskeys()}
              >
                Login with Passkey
              </button>

              <div>
                <p>or</p>
              </div>

              <h2>Sign Up</h2>

              <input
                type="text"
                placeholder="Email"
                value={email()}
                onChange={handleEmailChange}
              />
              <button
                class="login-button"
                onClick={startSignupProcess}
                disabled={disabledSignUp()}
              >
                Continue
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
              <div>
                <p>
                  <a href="#">Lost your credentials?</a>
                </p>
              </div>
            </Show>
          </div>
        </div>
      </div>
    </Show>
  );
};

export default Login;
