import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import { ToastProvider } from '@castmill/ui-common';
import NetworkSettings from './network-settings';
import { NetworkService } from '../../services/network.service';

// Toast spies
const toastSpies = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
};

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return {
    ...actual,
    useToast: () => toastSpies,
  };
});

vi.mock('../../services/network.service', () => ({
  NetworkService: {
    updateSettings: vi.fn(),
  },
}));

vi.mock('../../store', () => ({
  get store() {
    return { network: { isAdmin: true }, networkSettings: {} };
  },
  setStore: vi.fn(),
}));

const mockSettings = {
  id: 'network-123',
  name: 'Test Network',
  domain: 'test.example.com',
  email: 'support@test.com',
  logo: 'https://example.com/logo.png',
  copyright: '© 2025 Test',
  invitation_only: false,
  invitation_only_org_admins: true,
  default_locale: 'en',
  privacy_policy_url: null,
  meta: {},
  inserted_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const mockSetSettings = vi.fn();

// Mock the context to provide pre-loaded data
vi.mock('./network-context', () => ({
  useNetworkContext: () => ({
    settings: () => mockSettings,
    setSettings: mockSetSettings,
    stats: () => null,
    setStats: vi.fn(),
    loading: () => false,
    error: () => null,
    reload: vi.fn(),
  }),
}));

const renderSettings = () =>
  render(() => (
    <I18nProvider>
      <NetworkSettings />
    </I18nProvider>
  ));

describe('NetworkSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads and displays network settings in the form', async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
      expect(screen.getByDisplayValue('support@test.com')).toBeInTheDocument();
    });
  });

  it('enables save button when form is modified', async () => {
    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Test Network');
    fireEvent.input(nameInput, { target: { value: 'Updated Network' } });

    await waitFor(() => {
      const saveButton = screen.getByText(/save/i);
      expect(saveButton.closest('button')).not.toBeDisabled();
    });
  });

  it('saves settings when save button is clicked', async () => {
    const updated = { ...mockSettings, name: 'Updated Network' };
    vi.mocked(NetworkService.updateSettings).mockResolvedValue(updated);

    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Test Network');
    fireEvent.input(nameInput, { target: { value: 'Updated Network' } });

    const saveButton = screen.getByText(/save/i).closest('button');
    fireEvent.click(saveButton!);

    await waitFor(() => {
      expect(NetworkService.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Network' })
      );
      expect(toastSpies.success).toHaveBeenCalled();
    });
  });

  it('shows toast error when save fails', async () => {
    vi.mocked(NetworkService.updateSettings).mockRejectedValue(
      new Error('Save failed')
    );

    renderSettings();

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Network')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Test Network');
    fireEvent.input(nameInput, { target: { value: 'Updated Network' } });

    const saveButton = screen.getByText(/save/i).closest('button');
    fireEvent.click(saveButton!);

    await waitFor(() => {
      expect(toastSpies.error).toHaveBeenCalled();
    });
  });
});
