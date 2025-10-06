import {
  Component,
  createSignal,
  createMemo,
  onMount,
  Show,
  For,
} from 'solid-js';
import { Button, FormItem, Timestamp } from '@castmill/ui-common';
import { getUser } from '../../components/auth';
import { UserService } from '../../services/user.service';
import { User } from '../../interfaces/user.interface';
import {
  Credential,
  EmailVerificationState,
} from '../../interfaces/credential.interface';
import './settings-page.scss';

const SettingsPage: Component = () => {
  const [user, setUser] = createSignal<User | null>(null);
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [error, setError] = createSignal('');

  // Track if form has unsaved changes
  const isDirty = createMemo(() => {
    const currentUser = user();
    if (!currentUser) return false;
    return (
      name() !== (currentUser.name || '') ||
      email() !== (currentUser.email || '')
    );
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  // Credential management
  const [credentials, setCredentials] = createSignal<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = createSignal(false);
  const [credentialsError, setCredentialsError] = createSignal('');
  const [editingCredential, setEditingCredential] = createSignal<string | null>(
    null
  );
  const [newCredentialName, setNewCredentialName] = createSignal('');

  // Email verification
  const [emailVerification, setEmailVerification] =
    createSignal<EmailVerificationState>({
      verificationSent: false,
      isVerifying: false,
    });

  onMount(async () => {
    const currentUser = getUser();
    if (currentUser && currentUser.id) {
      setUser(currentUser as User);
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
      await loadCredentials(currentUser.id);
    }
  });

  const loadCredentials = async (userId: string) => {
    setCredentialsLoading(true);
    setCredentialsError('');
    try {
      const response = await UserService.getUserCredentials(userId);
      setCredentials(response.credentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);

      // If we get an unauthorized error, the session has expired
      if (err instanceof Error && err.message === 'Unauthorized') {
        setCredentialsError(
          'Your session has expired. Redirecting to login...'
        );
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
      } else {
        // For other errors, show a generic error message
        setCredentialsError(
          'Failed to load credentials. Please try refreshing the page.'
        );
      }
    } finally {
      setCredentialsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    const currentUser = user();
    if (!currentUser?.id) return;

    setLoading(true);
    setError('');
    setSaveSuccess(false);

    try {
      const updates: Partial<User> = {};
      const nameChanged = name() !== currentUser.name;
      const emailChanged = email() !== currentUser.email;

      if (nameChanged) {
        updates.name = name();
      }

      // Handle email change with verification
      if (emailChanged) {
        await UserService.sendEmailVerification(currentUser.id, email());
        setEmailVerification({
          pendingEmail: email(),
          verificationSent: true,
          isVerifying: false,
        });
        // Reset email to original value until verified
        setEmail(currentUser.email || '');
      }

      if (Object.keys(updates).length > 0) {
        await UserService.updateProfile(currentUser.id, updates);
        // Update the user signal with new values to reset isDirty state
        setUser({ ...currentUser, ...updates });
      }

      if (emailChanged) {
        setSaveSuccess(false); // Don't show success for email yet
        // Show different message for email verification
        setError(''); // Clear any previous errors
      } else {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      setError('Failed to update profile. Please try again.');
      console.error('Profile update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    const currentUser = user();
    if (!currentUser?.id) return;

    setLoading(true);
    setError('');

    try {
      await UserService.deleteAccount(currentUser.id);
      // Redirect to login or show success message
      window.location.href = '/login';
    } catch (err) {
      setError('Failed to delete account. Please try again.');
      console.error('Account deletion error:', err);
    } finally {
      setLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDeleteCredential = async (credentialId: string) => {
    const currentUser = user();
    if (!currentUser?.id) return;

    // Confirm before deleting
    const confirmed = window.confirm(
      'Are you sure you want to remove this passkey?\n\n' +
        "Note: This will remove the passkey from your account, but you may need to manually delete it from your device's settings (like iCloud Keychain, Google Password Manager, or Windows Hello).\n\n" +
        'Make sure you have tested your other passkey(s) work before removing this one.'
    );

    if (!confirmed) return;

    try {
      await UserService.deleteCredential(currentUser.id, credentialId);
      // Reload credentials list
      await loadCredentials(currentUser.id);
    } catch (err) {
      console.error('Delete credential error:', err);

      // Handle authorization errors specifically
      if (err instanceof Error && err.message === 'Unauthorized') {
        setCredentialsError('Your session has expired. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setCredentialsError('Failed to delete passkey. Please try again.');
      }
    }
  };

  const handleUpdateCredentialName = async (credentialId: string) => {
    const currentUser = user();
    if (!currentUser?.id || !newCredentialName()) return;

    try {
      await UserService.updateCredentialName(
        currentUser.id,
        credentialId,
        newCredentialName()
      );
      setEditingCredential(null);
      setNewCredentialName('');
      // Reload credentials list
      await loadCredentials(currentUser.id);
    } catch (err) {
      console.error('Update credential error:', err);

      // Handle authorization errors specifically
      if (err instanceof Error && err.message === 'Unauthorized') {
        setCredentialsError('Your session has expired. Please log in again.');
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setCredentialsError('Failed to update passkey name. Please try again.');
      }
    }
  };

  const handleAddNewPasskey = async () => {
    const currentUser = user();
    if (!currentUser?.id) return;

    try {
      setCredentialsError('');

      // Step 1: Get a challenge from the server
      const { challenge, user_id } =
        await UserService.createCredentialChallenge(currentUser.id);

      // Step 2: Create the credential using WebAuthn
      // Decode the base64url challenge string to bytes
      const base64urlToUint8Array = (base64url: string) => {
        // Convert base64url to base64
        const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        // Decode base64 to binary string
        const binaryString = atob(base64);
        // Convert binary string to Uint8Array
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
      };

      const createOptions: CredentialCreationOptions = {
        publicKey: {
          challenge: base64urlToUint8Array(challenge),
          rp: {
            name: 'Castmill',
            id: window.location.hostname,
          },
          user: {
            id: Uint8Array.from(user_id, (c) => c.charCodeAt(0)),
            name: currentUser.email || 'user@castmill.io',
            displayName: currentUser.name || 'Castmill User',
          },
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' }, // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            userVerification: 'required',
            requireResidentKey: false,
            residentKey: 'preferred',
          },
          timeout: 60000,
        },
      };

      const credential = await navigator.credentials.create(createOptions);
      if (!credential) {
        throw new Error('Failed to create credential');
      }

      const publicKeyCredential = credential as PublicKeyCredential;
      const authAttestationResponse =
        publicKeyCredential.response as AuthenticatorAttestationResponse;
      const publicKey = authAttestationResponse.getPublicKey();

      if (!publicKey) {
        throw new Error('Could not get public key');
      }

      // Step 3: Send the credential to the server
      const arrayBufferToBase64 = (buffer: ArrayBuffer) => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      await UserService.addCredential(
        currentUser.id,
        publicKeyCredential.id,
        arrayBufferToBase64(publicKey),
        new Uint8Array(authAttestationResponse.clientDataJSON)
      );

      // Step 4: Reload credentials to show the new one
      await loadCredentials(currentUser.id);

      setCredentialsError(''); // Clear any previous errors
    } catch (err) {
      console.error('Failed to add new passkey:', err);

      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setCredentialsError('Passkey creation was cancelled or timed out.');
        } else if (err.message === 'Unauthorized') {
          setCredentialsError(
            'Authentication error: Your session may have expired. Please refresh the page and try again.'
          );
          // Temporarily disabled redirect to debug
          // setTimeout(() => {
          //   window.location.href = '/login';
          // }, 2000);
        } else {
          setCredentialsError(`Failed to add passkey: ${err.message}`);
        }
      } else {
        setCredentialsError('Failed to add new passkey. Please try again.');
      }
    }
  };

  const startEditingCredential = (credential: Credential) => {
    setEditingCredential(credential.id);
    setNewCredentialName(credential.name);
  };

  const cancelEditingCredential = () => {
    setEditingCredential(null);
    setNewCredentialName('');
  };

  return (
    <div class="castmill-settings">
      <div class="settings-header">
        <h1>Account Settings</h1>
        <p>Manage your account information and preferences</p>
      </div>

      <div class="settings-sections">
        {/* Profile Settings */}
        <section class="settings-section">
          <h2>Profile Information</h2>
          <div class="settings-content">
            <FormItem
              label="Full Name"
              id="name"
              value={name()}
              type="text"
              placeholder="Enter your full name"
              onInput={(value) => setName(String(value))}
            >
              <></>
            </FormItem>

            <FormItem
              label="Email Address"
              id="email"
              value={email()}
              type="email"
              placeholder="Enter your email address"
              onInput={(value) => setEmail(String(value))}
              description="Changes to your email address require verification to prevent account lockout"
            >
              <></>
            </FormItem>

            <Show when={emailVerification().verificationSent}>
              <div class="email-verification-notice">
                <p>
                  <strong>Email verification required!</strong>
                </p>
                <p>
                  To prevent account lockout, please verify your new email
                  address ({emailVerification().pendingEmail}) by clicking the
                  verification link we sent. Your email will only be updated
                  after verification.
                </p>
              </div>
            </Show>

            <div class="form-actions">
              <Button
                label="Save Changes"
                onClick={handleSaveProfile}
                disabled={!isDirty() || loading()}
                color="primary"
              />
              <Show when={saveSuccess()}>
                <span class="success-message">
                  Profile updated successfully!
                </span>
              </Show>
              <Show when={error()}>
                <span class="error-message">{error()}</span>
              </Show>
            </div>
          </div>
        </section>

        {/* Passkey Settings */}
        <section class="settings-section">
          <h2>Security & Authentication</h2>
          <div class="settings-content">
            <div class="passkey-info">
              <h3>Passkeys</h3>
              <p>
                Your account uses passkeys for secure, passwordless
                authentication. Passkeys are stored securely on your device and
                provide better security than traditional passwords.
              </p>

              <div class="passkey-list">
                <h4>Your Passkeys</h4>
                <Show when={credentialsLoading()}>
                  <p>Loading passkeys...</p>
                </Show>
                <Show
                  when={
                    !credentialsLoading() &&
                    credentialsError() &&
                    credentials().length === 0
                  }
                >
                  <div class="error-container">
                    <p class="error-message">{credentialsError()}</p>
                    <Show
                      when={!credentialsError().includes('session has expired')}
                    >
                      <Button
                        label="Retry"
                        onClick={() => {
                          const currentUser = user();
                          if (currentUser?.id) {
                            loadCredentials(currentUser.id);
                          }
                        }}
                        color="secondary"
                      />
                    </Show>
                  </div>
                </Show>
                <Show
                  when={
                    !credentialsLoading() &&
                    !credentialsError() &&
                    credentials().length === 0
                  }
                >
                  <p>No passkeys found.</p>
                </Show>
                <For each={credentials()}>
                  {(credential) => (
                    <div class="passkey-item">
                      <div class="passkey-info-row">
                        <Show when={editingCredential() !== credential.id}>
                          <div class="passkey-details">
                            <span class="passkey-name">{credential.name}</span>
                            <span class="passkey-date">
                              Added{' '}
                              <Timestamp
                                value={credential.inserted_at}
                                mode="relative"
                              />
                            </span>
                          </div>
                          <div class="passkey-actions">
                            <Button
                              label="Rename"
                              onClick={() => startEditingCredential(credential)}
                              color="secondary"
                            />
                            <Button
                              label="Remove"
                              onClick={() =>
                                handleDeleteCredential(credential.id)
                              }
                              color="danger"
                              disabled={credentials().length === 1}
                            />
                          </div>
                        </Show>
                        <Show when={editingCredential() === credential.id}>
                          <div class="passkey-edit">
                            <FormItem
                              label="Passkey Name"
                              id={`credential-name-${credential.id}`}
                              value={newCredentialName()}
                              type="text"
                              placeholder="Enter a name for this passkey"
                              onInput={(value) =>
                                setNewCredentialName(String(value))
                              }
                            >
                              <></>
                            </FormItem>
                            <div class="edit-actions">
                              <Button
                                label="Save"
                                onClick={() =>
                                  handleUpdateCredentialName(credential.id)
                                }
                                color="primary"
                              />
                              <Button
                                label="Cancel"
                                onClick={cancelEditingCredential}
                                color="secondary"
                              />
                            </div>
                          </div>
                        </Show>
                      </div>
                    </div>
                  )}
                </For>
              </div>

              <div class="passkey-actions">
                <Button
                  label="Add New Passkey"
                  onClick={handleAddNewPasskey}
                  color="secondary"
                  disabled={false}
                />
                <small>Add a passkey for another device or browser</small>
              </div>
            </div>
          </div>
        </section>

        {/* Account Management */}
        <section class="settings-section danger-zone">
          <h2>Account Management</h2>
          <div class="settings-content">
            <div class="danger-actions">
              <h3>Delete Account</h3>
              <p>
                Permanently delete your account and all associated data. This
                action cannot be undone.
              </p>
              <Show when={!showDeleteConfirm()}>
                <Button
                  label="Delete Account"
                  onClick={() => setShowDeleteConfirm(true)}
                  color="danger"
                />
              </Show>
              <Show when={showDeleteConfirm()}>
                <div class="delete-confirmation">
                  <p>
                    <strong>Are you sure?</strong> This will permanently delete
                    your account.
                  </p>
                  <div class="confirmation-actions">
                    <Button
                      label="Yes, Delete Account"
                      onClick={handleDeleteAccount}
                      disabled={loading()}
                      color="danger"
                    />
                    <Button
                      label="Cancel"
                      onClick={() => setShowDeleteConfirm(false)}
                      color="secondary"
                    />
                  </div>
                </div>
              </Show>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;
