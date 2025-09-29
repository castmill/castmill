import { render, screen } from '@solidjs/testing-library';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SettingsPage from './settings-page';

// Mock the auth module
vi.mock('../../components/auth', () => ({
  getUser: vi.fn(() => ({
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  })),
}));

// Mock the user service
vi.mock('../../services/user.service', () => ({
  UserService: {
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
    getCurrentUser: vi.fn(),
    checkOrganizationOwnership: vi.fn(),
    getUserCredentials: vi.fn(() => Promise.resolve({ credentials: [] })),
    deleteCredential: vi.fn(),
    updateCredentialName: vi.fn(),
    sendEmailVerification: vi.fn(),
    verifyEmail: vi.fn(),
  },
}));

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the settings page with all sections', () => {
    render(() => <SettingsPage />);

    // Check main heading
    expect(screen.getByText('Account Settings')).toBeInTheDocument();
    expect(
      screen.getByText('Manage your account information and preferences')
    ).toBeInTheDocument();

    // Check profile section
    expect(screen.getByText('Profile Information')).toBeInTheDocument();
    expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Email Address')).toBeInTheDocument();

    // Check security section
    expect(screen.getByText('Security & Authentication')).toBeInTheDocument();
    expect(screen.getByText('Passkeys')).toBeInTheDocument();
    expect(screen.getByText('Your Passkeys')).toBeInTheDocument();

    // Check danger zone
    expect(screen.getByText('Account Management')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete Account' })).toBeInTheDocument();
  });

  it('displays passkey management section', () => {
    render(() => <SettingsPage />);

    expect(
      screen.getByText(
        /Your account uses passkeys for secure, passwordless authentication/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Add New Passkey')).toBeInTheDocument();
    expect(screen.getByText('Adding new passkeys coming soon')).toBeInTheDocument();
  });

  it('pre-populates form fields with user data', () => {
    render(() => <SettingsPage />);

    const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
    const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;

    expect(nameInput.value).toBe('John Doe');
    expect(emailInput.value).toBe('john@example.com');
  });

  it('displays the passkey information section', () => {
    render(() => <SettingsPage />);

    expect(
      screen.getByText(
        /Your account uses passkeys for secure, passwordless authentication/
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Manage Passkeys')).toBeInTheDocument();
    expect(screen.getByText('Passkey management coming soon')).toBeInTheDocument();
  });

  it('shows delete account confirmation when delete button is clicked', async () => {
    render(() => <SettingsPage />);

    const deleteButton = screen.getByRole('button', { name: 'Delete Account' });
    deleteButton.click();

    expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yes, Delete Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('shows email verification notice when email verification is sent', async () => {
    const { UserService } = await import('../../services/user.service');
    (UserService.sendEmailVerification as any).mockResolvedValue({ status: 'ok' });

    render(() => <SettingsPage />);

    const emailInput = screen.getByLabelText('Email Address') as HTMLInputElement;
    emailInput.value = 'newemail@example.com';
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));

    const saveButton = screen.getByRole('button', { name: 'Save Changes' });
    saveButton.click();

    // Wait for the email verification notice to appear
    await new Promise(resolve => setTimeout(resolve, 100));

    expect(screen.getByText('Email verification sent!')).toBeInTheDocument();
  });
});