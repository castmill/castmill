import { Component, createSignal, onMount, Show, For } from 'solid-js';
import { Button, FormItem } from '@castmill/ui-common';
import { getUser } from '../../components/auth';
import { UserService } from '../../services/user.service';
import { User } from '../../interfaces/user.interface';
import { Credential, EmailVerificationState } from '../../interfaces/credential.interface';
import './settings-page.scss';

const SettingsPage: Component = () => {
  const [user, setUser] = createSignal<User | null>(null);
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [error, setError] = createSignal('');
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  
  // Credential management
  const [credentials, setCredentials] = createSignal<Credential[]>([]);
  const [credentialsLoading, setCredentialsLoading] = createSignal(false);
  const [editingCredential, setEditingCredential] = createSignal<string | null>(null);
  const [newCredentialName, setNewCredentialName] = createSignal('');
  
  // Email verification
  const [emailVerification, setEmailVerification] = createSignal<EmailVerificationState>({
    verificationSent: false,
    isVerifying: false
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
    try {
      const response = await UserService.getUserCredentials(userId);
      setCredentials(response.credentials);
    } catch (err) {
      console.error('Failed to load credentials:', err);
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
          isVerifying: false
        });
        // Reset email to original value until verified
        setEmail(currentUser.email || '');
      }

      if (Object.keys(updates).length > 0) {
        await UserService.updateProfile(currentUser.id, updates);
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

    try {
      await UserService.deleteCredential(currentUser.id, credentialId);
      // Reload credentials list
      await loadCredentials(currentUser.id);
    } catch (err) {
      setError('Failed to delete passkey. Please try again.');
      console.error('Delete credential error:', err);
    }
  };

  const handleUpdateCredentialName = async (credentialId: string) => {
    const currentUser = user();
    if (!currentUser?.id || !newCredentialName()) return;

    try {
      await UserService.updateCredentialName(currentUser.id, credentialId, newCredentialName());
      setEditingCredential(null);
      setNewCredentialName('');
      // Reload credentials list
      await loadCredentials(currentUser.id);
    } catch (err) {
      setError('Failed to update passkey name. Please try again.');
      console.error('Update credential error:', err);
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
            >
              <></>
            </FormItem>

            <Show when={emailVerification().verificationSent}>
              <div class="email-verification-notice">
                <p><strong>Email verification sent!</strong></p>
                <p>Please check your email ({emailVerification().pendingEmail}) and click the verification link to confirm your new email address.</p>
              </div>
            </Show>

            <div class="form-actions">
              <Button
                label="Save Changes"
                onClick={handleSaveProfile}
                disabled={loading()}
                color="primary"
              />
              <Show when={saveSuccess()}>
                <span class="success-message">Profile updated successfully!</span>
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
                Your account uses passkeys for secure, passwordless authentication. 
                Passkeys are stored securely on your device and provide better security 
                than traditional passwords.
              </p>
              
              <div class="passkey-list">
                <h4>Your Passkeys</h4>
                <Show when={credentialsLoading()}>
                  <p>Loading passkeys...</p>
                </Show>
                <Show when={!credentialsLoading() && credentials().length === 0}>
                  <p>No passkeys found.</p>
                </Show>
                <For each={credentials()}>
                  {(credential) => (
                    <div class="passkey-item">
                      <div class="passkey-info-row">
                        <Show when={editingCredential() !== credential.id}>
                          <div class="passkey-details">
                            <span class="passkey-name">{credential.name}</span>
                            <span class="passkey-date">Added {new Date(credential.inserted_at).toLocaleDateString()}</span>
                          </div>
                          <div class="passkey-actions">
                            <Button
                              label="Rename"
                              onClick={() => startEditingCredential(credential)}
                              color="secondary"
                            />
                            <Button
                              label="Remove"
                              onClick={() => handleDeleteCredential(credential.id)}
                              color="danger"
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
                              onInput={(value) => setNewCredentialName(String(value))}
                            >
                              <></>
                            </FormItem>
                            <div class="edit-actions">
                              <Button
                                label="Save"
                                onClick={() => handleUpdateCredentialName(credential.id)}
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
                  onClick={() => {/* TODO: Implement new passkey registration */}}
                  color="secondary"
                  disabled={true}
                />
                <small>Adding new passkeys coming soon</small>
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
                Permanently delete your account and all associated data. This action cannot be undone.
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
                  <p><strong>Are you sure?</strong> This will permanently delete your account.</p>
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
