import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import SettingsPage from './settings-page';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '@castmill/ui-common';

// Mock the auth module
vi.mock('../../components/auth', () => ({
  getUser: vi.fn(() => ({
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
  })),
  updateUser: vi.fn(),
}));

// Mock the user service
vi.mock('../../services/user.service', () => ({
  UserService: {
    updateProfile: vi.fn(),
    deleteAccount: vi.fn(),
    getCurrentUser: vi.fn(),
    checkOrganizationOwnership: vi.fn(),
    getUserCredentials: vi.fn(() =>
      Promise.resolve({
        credentials: [
          {
            id: 'cred1',
            name: 'My Laptop',
            inserted_at: '2024-01-01T00:00:00Z',
          },
        ],
      })
    ),
    deleteCredential: vi.fn(),
    updateCredentialName: vi.fn(),
    sendEmailVerification: vi.fn(),
    verifyEmail: vi.fn(),
    registerCredential: vi.fn(),
    beginCredentialRegistration: vi.fn(),
  },
}));

// Mock WebAuthn API
const mockNavigatorCredentials = {
  create: vi.fn(),
  get: vi.fn(),
};

Object.defineProperty(navigator, 'credentials', {
  value: mockNavigatorCredentials,
  writable: true,
});

describe('SettingsPage', () => {
  let UserService: any;

  // Helper function to render with I18nProvider and ToastProvider
  const renderWithProviders = (component: () => any) => {
    return render(() => (
      <I18nProvider>
        <ToastProvider>{component()}</ToastProvider>
      </I18nProvider>
    ));
  };

  beforeEach(async () => {
    const module = await import('../../services/user.service');
    UserService = module.UserService;
    vi.clearAllMocks();

    // Reset default mock implementation
    (UserService.getUserCredentials as any).mockResolvedValue({
      credentials: [
        { id: 'cred1', name: 'My Laptop', inserted_at: '2024-01-01T00:00:00Z' },
      ],
    });
  });

  describe('Basic Rendering', () => {
    it('renders the settings page with all sections', () => {
      renderWithProviders(() => <SettingsPage />);

      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(
        screen.getByText('Manage your account information and preferences')
      ).toBeInTheDocument();

      expect(screen.getByText('Profile Information')).toBeInTheDocument();
      expect(screen.getByLabelText('Full Name')).toBeInTheDocument();
      expect(screen.getByLabelText('Email Address')).toBeInTheDocument();

      expect(screen.getByText('Security & Authentication')).toBeInTheDocument();
      expect(screen.getByText('Account Management')).toBeInTheDocument();
    });

    it('pre-populates form fields with user data', () => {
      renderWithProviders(() => <SettingsPage />);

      const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
      const emailInput = screen.getByLabelText(
        'Email Address'
      ) as HTMLInputElement;

      expect(nameInput.value).toBe('John Doe');
      expect(emailInput.value).toBe('john@example.com');
    });
  });

  describe('Form Dirty State', () => {
    it('disables Save Changes button when form is not dirty', async () => {
      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: 'Save Changes' });
        expect(saveButton).toBeDisabled();
      });
    });

    it('enables Save Changes button when name is changed', async () => {
      renderWithProviders(() => <SettingsPage />);

      const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Jane Doe' } });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: 'Save Changes' });
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('enables Save Changes button when email is changed', async () => {
      renderWithProviders(() => <SettingsPage />);

      const emailInput = screen.getByLabelText(
        'Email Address'
      ) as HTMLInputElement;
      fireEvent.input(emailInput, { target: { value: 'jane@example.com' } });

      await waitFor(() => {
        const saveButton = screen.getByRole('button', { name: 'Save Changes' });
        expect(saveButton).not.toBeDisabled();
      });
    });

    it('disables Save Changes button after successful save', async () => {
      (UserService.updateProfile as any).mockResolvedValue({ status: 'ok' });

      renderWithProviders(() => <SettingsPage />);

      const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Jane Doe' } });

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserService.updateProfile).toHaveBeenCalledWith('1', {
          name: 'Jane Doe',
        });
      });

      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });
  });

  describe('Profile Updates', () => {
    it('calls updateProfile with name changes only', async () => {
      (UserService.updateProfile as any).mockResolvedValue({ status: 'ok' });

      renderWithProviders(() => <SettingsPage />);

      const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Jane Doe' } });

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserService.updateProfile).toHaveBeenCalledWith('1', {
          name: 'Jane Doe',
        });
      });
    });

    it('shows success message after profile update', async () => {
      (UserService.updateProfile as any).mockResolvedValue({ status: 'ok' });

      renderWithProviders(() => <SettingsPage />);

      const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Jane Doe' } });

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(
          screen.getByText('Profile updated successfully!')
        ).toBeInTheDocument();
      });
    });

    it('handles email verification flow', async () => {
      (UserService.sendEmailVerification as any).mockResolvedValue({
        status: 'ok',
      });

      renderWithProviders(() => <SettingsPage />);

      const emailInput = screen.getByLabelText(
        'Email Address'
      ) as HTMLInputElement;
      fireEvent.input(emailInput, {
        target: { value: 'newemail@example.com' },
      });

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserService.sendEmailVerification).toHaveBeenCalledWith(
          '1',
          'newemail@example.com'
        );
      });

      await waitFor(() => {
        expect(
          screen.getByText(/Email verification required/)
        ).toBeInTheDocument();
      });
    });

    it('updates global user state when name is changed', async () => {
      const { updateUser } = await import('../../components/auth');
      (UserService.updateProfile as any).mockResolvedValue({ status: 'ok' });

      renderWithI18n(() => <SettingsPage />);

      const nameInput = screen.getByLabelText('Full Name') as HTMLInputElement;
      fireEvent.input(nameInput, { target: { value: 'Jane Doe' } });

      const saveButton = screen.getByRole('button', { name: 'Save Changes' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(updateUser).toHaveBeenCalledWith({
          name: 'Jane Doe',
        });
      });
    });
  });

  describe('Passkey Management', () => {
    it('displays list of passkeys', async () => {
      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('My Laptop')).toBeInTheDocument();
      });
    });

    it('shows Add New Passkey button', async () => {
      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        expect(
          screen.getByRole('button', { name: 'Add New Passkey' })
        ).toBeInTheDocument();
      });
    });

    it('allows renaming a passkey', async () => {
      (UserService.updateCredentialName as any).mockResolvedValue({
        status: 'ok',
      });

      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('My Laptop')).toBeInTheDocument();
      });

      const renameButton = screen.getByRole('button', { name: 'Rename' });
      fireEvent.click(renameButton);

      await waitFor(() => {
        const input = screen.getByDisplayValue('My Laptop') as HTMLInputElement;
        expect(input).toBeInTheDocument();
      });

      const input = screen.getByDisplayValue('My Laptop') as HTMLInputElement;
      fireEvent.input(input, { target: { value: 'Work Laptop' } });

      const saveButton = screen.getByRole('button', { name: 'Save' });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(UserService.updateCredentialName).toHaveBeenCalledWith(
          '1',
          'cred1',
          'Work Laptop'
        );
      });
    });

    it('disables Remove button when only one passkey exists', async () => {
      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        const removeButton = screen.getByRole('button', { name: 'Remove' });
        expect(removeButton).toBeDisabled();
      });
    });

    it('enables Remove button when multiple passkeys exist', async () => {
      (UserService.getUserCredentials as any).mockResolvedValue({
        credentials: [
          {
            id: 'cred1',
            name: 'My Laptop',
            inserted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'cred2',
            name: 'My Phone',
            inserted_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
        expect(removeButtons).toHaveLength(2);
        removeButtons.forEach((button) => {
          expect(button).not.toBeDisabled();
        });
      });
    });

    it('shows confirmation dialog before deleting passkey', async () => {
      (UserService.getUserCredentials as any).mockResolvedValue({
        credentials: [
          {
            id: 'cred1',
            name: 'My Laptop',
            inserted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'cred2',
            name: 'My Phone',
            inserted_at: '2024-01-02T00:00:00Z',
          },
        ],
      });

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('My Laptop')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
      fireEvent.click(removeButtons[0]);

      expect(confirmSpy).toHaveBeenCalled();
      expect(UserService.deleteCredential).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('deletes passkey after confirmation', async () => {
      (UserService.getUserCredentials as any).mockResolvedValue({
        credentials: [
          {
            id: 'cred1',
            name: 'My Laptop',
            inserted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'cred2',
            name: 'My Phone',
            inserted_at: '2024-01-02T00:00:00Z',
          },
        ],
      });
      (UserService.deleteCredential as any).mockResolvedValue({ status: 'ok' });

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderWithProviders(() => <SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('My Laptop')).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByRole('button', { name: 'Remove' });
      fireEvent.click(removeButtons[0]);

      await waitFor(() => {
        expect(UserService.deleteCredential).toHaveBeenCalledWith('1', 'cred1');
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Delete Account', () => {
    it('shows delete account confirmation when delete button is clicked', async () => {
      renderWithProviders(() => <SettingsPage />);

      const deleteButton = screen.getByRole('button', {
        name: 'Delete Account',
      });
      fireEvent.click(deleteButton);

      await waitFor(() => {
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Yes, Delete Account' })
        ).toBeInTheDocument();
        expect(
          screen.getByRole('button', { name: 'Cancel' })
        ).toBeInTheDocument();
      });
    });
  });
});
