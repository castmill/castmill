import {
  Component,
  createSignal,
  createMemo,
  onMount,
  Show,
  For,
} from 'solid-js';
import { Button, FormItem, Timestamp, useToast } from '@castmill/ui-common';
import { getUser, updateUser } from '../../components/auth';
import { UserService } from '../../services/user.service';
import { User } from '../../interfaces/user.interface';
import {
  Credential,
  EmailVerificationState,
} from '../../interfaces/credential.interface';
import './settings-page.scss';
import { useI18n, SUPPORTED_LOCALES } from '../../i18n';

const SettingsPage: Component = () => {
  const { t, locale, setLocale } = useI18n();
  const toast = useToast();
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
        // Update the local user signal with new values to reset isDirty state
        setUser({ ...currentUser, ...updates });
        // Update the global user state so the topbar reacts to the change
        updateUser(updates);
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
      toast.success(t('settings.deleteAccountSuccess'));
      // Redirect to login after brief delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
    } catch (err) {
      // Extract error message from response if available
      let errorMessage = t('settings.deleteAccountError');

      if (err instanceof Error) {
        const errorText = err.message;

        // Check if it's the sole administrator error
        if (errorText.includes('sole administrator')) {
          // Extract organization name from error message
          const match = errorText.match(/of '([^']+)'/);
          const orgName = match ? match[1] : '';

          if (orgName) {
            errorMessage = t('settings.soleAdministratorError', { orgName });
          } else {
            errorMessage = t('settings.soleAdministratorErrorGeneric');
          }
        } else if (errorText) {
          errorMessage = errorText;
        }
      }

      toast.error(errorMessage, 0); // No auto-dismiss for critical errors
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
        <h1>{t('settings.title')}</h1>
        <p>{t('settings.description')}</p>
      </div>

      <div class="settings-sections">
        {/* Profile Settings */}
        <section class="settings-section">
          <h2>{t('settings.profile')}</h2>
          <div class="settings-content">
            <FormItem
              label={t('settings.fullName')}
              id="name"
              value={name()}
              type="text"
              placeholder={t('settings.placeholderFullName')}
              onInput={(value) => setName(String(value))}
            >
              <></>
            </FormItem>

            <FormItem
              label={t('settings.emailAddress')}
              id="email"
              value={email()}
              type="email"
              placeholder={t('settings.placeholderEmail')}
              onInput={(value) => setEmail(String(value))}
              description={t('settings.emailChangeWarning')}
            >
              <></>
            </FormItem>

            <Show when={emailVerification().verificationSent}>
              <div class="email-verification-notice">
                <p>
                  <strong>{t('settings.emailVerificationRequired')}</strong>
                </p>
                <p>
                  {t('settings.emailVerificationMessage', {
                    email: emailVerification().pendingEmail || '',
                  })}
                </p>
              </div>
            </Show>

            <div class="form-actions">
              <Button
                label={t('settings.saveChanges')}
                onClick={handleSaveProfile}
                disabled={!isDirty() || loading()}
                color="primary"
              />
              <Show when={saveSuccess()}>
                <span class="success-message">
                  {t('settings.profileUpdatedSuccess')}
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
          <h2>{t('settings.securityAuthentication')}</h2>
          <div class="settings-content">
            <div class="passkey-info">
              <h3>{t('settings.passkeys')}</h3>
              <p>{t('settings.passkeysDescription')}</p>

              <div class="passkey-list">
                <h4>{t('settings.yourPasskeys')}</h4>
                <Show when={credentialsLoading()}>
                  <p>{t('settings.loadingPasskeys')}</p>
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
                        label={t('settings.retry')}
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
                  <p>{t('settings.noPasskeysFound')}</p>
                </Show>
                <For each={credentials()}>
                  {(credential) => (
                    <div class="passkey-item">
                      <div class="passkey-info-row">
                        <Show when={editingCredential() !== credential.id}>
                          <div class="passkey-details">
                            <span class="passkey-name">{credential.name}</span>
                            <span class="passkey-date">
                              {t('settings.added')}{' '}
                              <Timestamp
                                value={credential.inserted_at}
                                mode="relative"
                              />
                            </span>
                          </div>
                          <div class="passkey-actions">
                            <Button
                              label={t('settings.rename')}
                              onClick={() => startEditingCredential(credential)}
                              color="secondary"
                            />
                            <Button
                              label={t('common.remove')}
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
                              label={t('settings.passkeyName')}
                              id={`credential-name-${credential.id}`}
                              value={newCredentialName()}
                              type="text"
                              placeholder={t('settings.placeholderPasskeyName')}
                              onInput={(value) =>
                                setNewCredentialName(String(value))
                              }
                            >
                              <></>
                            </FormItem>
                            <div class="edit-actions">
                              <Button
                                label={t('common.save')}
                                onClick={() =>
                                  handleUpdateCredentialName(credential.id)
                                }
                                color="primary"
                              />
                              <Button
                                label={t('common.cancel')}
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
                  label={t('settings.addNewPasskey')}
                  onClick={handleAddNewPasskey}
                  color="secondary"
                  disabled={false}
                />
                <small>{t('settings.addPasskeyHelp')}</small>
              </div>
            </div>
          </div>
        </section>

        {/* Language Settings */}
        <section class="settings-section">
          <h2>{t('settings.languageSettings')}</h2>
          <div class="settings-content">
            <p>{t('settings.selectLanguage')}</p>
            <div class="language-options">
              <For each={SUPPORTED_LOCALES}>
                {(localeInfo) => (
                  <button
                    class="language-option"
                    classList={{ active: locale() === localeInfo.code }}
                    onClick={() => setLocale(localeInfo.code)}
                  >
                    <span class="language-code">
                      {localeInfo.code.toUpperCase()}
                    </span>
                    <span class="language-name">{localeInfo.nativeName}</span>
                    <Show when={locale() === localeInfo.code}>
                      <span class="language-check">✓</span>
                    </Show>
                  </button>
                )}
              </For>
            </div>
          </div>
        </section>

        {/* Account Management */}
        <section class="settings-section danger-zone">
          <h2>{t('settings.accountManagement')}</h2>
          <div class="settings-content">
            <div class="danger-actions">
              <h3>{t('settings.deleteAccount')}</h3>
              <p>{t('settings.deleteAccountDescription')}</p>
              <Show when={!showDeleteConfirm()}>
                <Button
                  label={t('settings.deleteAccountButton')}
                  onClick={() => setShowDeleteConfirm(true)}
                  color="danger"
                />
              </Show>
              <Show when={showDeleteConfirm()}>
                <div class="delete-confirmation">
                  <p>
                    <strong>{t('settings.deleteAccountConfirm')}</strong>{' '}
                    {t('settings.deleteAccountWarning')}
                  </p>
                  <div class="confirmation-actions">
                    <Button
                      label={t('settings.deleteAccountYes')}
                      onClick={handleDeleteAccount}
                      disabled={loading()}
                      color="danger"
                    />
                    <Button
                      label={t('common.cancel')}
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
