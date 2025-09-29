import { Component, createSignal, onMount, Show } from 'solid-js';
import { Button, FormItem } from '@castmill/ui-common';
import { getUser } from '../../components/auth';
import { UserService } from '../../services/user.service';
import { User } from '../../interfaces/user.interface';
import './settings-page.scss';

const SettingsPage: Component = () => {
  const [user, setUser] = createSignal<User | null>(null);
  const [name, setName] = createSignal('');
  const [email, setEmail] = createSignal('');
  const [loading, setLoading] = createSignal(false);
  const [saveSuccess, setSaveSuccess] = createSignal(false);
  const [error, setError] = createSignal('');
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);

  onMount(async () => {
    const currentUser = getUser();
    if (currentUser && currentUser.id) {
      setUser(currentUser as User);
      setName(currentUser.name || '');
      setEmail(currentUser.email || '');
    }
  });

  const handleSaveProfile = async () => {
    const currentUser = user();
    if (!currentUser?.id) return;

    setLoading(true);
    setError('');
    setSaveSuccess(false);

    try {
      const updates: Partial<User> = {};
      if (name() !== currentUser.name) updates.name = name();
      if (email() !== currentUser.email) updates.email = email();

      if (Object.keys(updates).length > 0) {
        await UserService.updateProfile(currentUser.id, updates);
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
              <div class="passkey-actions">
                <Button
                  label="Manage Passkeys"
                  onClick={() => {/* TODO: Implement passkey management */}}
                  color="secondary"
                  disabled={true}
                />
                <small>Passkey management coming soon</small>
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
