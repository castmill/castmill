import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { HttpError } from '@castmill/ui-common';
import { I18nProvider } from '../../i18n';
import {
  OrganizationIntegrationSettings,
  orderedFields,
  toFormValues,
  toSettings,
} from './organization-integration-settings';
import { NetworkService } from '../../services/network.service';

const toastSpies = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => toastSpies };
});

vi.mock('../../services/network.service', () => ({
  NetworkService: {
    listIntegrationSettings: vi.fn(),
    updateIntegrationSettings: vi.fn(),
    deleteIntegrationSettings: vi.fn(),
  },
}));

const organization = {
  id: 'org-1',
  name: 'Fastighetsbyrån Lund',
  inserted_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
} as any;

const listing = {
  key: 'property-listing',
  name: 'Property listings',
  description: 'Agency and offices whose listings are shown.',
  schema: {
    agency: {
      type: 'string' as const,
      label: 'Agency',
      required: true,
      order: 1,
    },
    office_ids: {
      type: 'list' as const,
      label: 'Office IDs',
      description: 'Office IDs in the agency system.',
      order: 2,
    },
    limit: { type: 'number' as const, label: 'Limit' },
    enabled: { type: 'boolean' as const, label: 'Enabled' },
  },
  settings: { agency: 'fb', office_ids: ['M1', 'M2'] },
};

const renderDialog = (onClose = vi.fn()) =>
  render(() => (
    <I18nProvider>
      <OrganizationIntegrationSettings
        organization={organization}
        onClose={onClose}
      />
    </I18nProvider>
  ));

describe('OrganizationIntegrationSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(NetworkService.listIntegrationSettings).mockResolvedValue([
      listing,
    ]);
  });

  it('shows the settings and saves them', async () => {
    renderDialog();
    await waitFor(() =>
      expect(screen.getByText('Property listings')).toBeTruthy()
    );
    expect(
      screen.getByText('Integration settings – Fastighetsbyrån Lund')
    ).toBeTruthy();

    const agency = screen.getByLabelText('Agency *') as HTMLInputElement;
    const offices = screen.getByLabelText('Office IDs') as HTMLTextAreaElement;
    expect(agency.value).toBe('fb');
    expect(offices.value).toBe('M1\nM2');
    expect(
      screen.getByText('Office IDs in the agency system. One value per line.')
    ).toBeTruthy();

    fireEvent.input(agency, { target: { value: 'lff' } });
    fireEvent.input(offices, { target: { value: 'M3\nM4\n' } });
    fireEvent.input(screen.getByLabelText('Limit'), {
      target: { value: '2.5' },
    });
    expect(screen.getByLabelText('Limit').getAttribute('step')).toBe('any');
    fireEvent.change(screen.getByLabelText('Enabled'), {
      target: { checked: true },
    });

    vi.mocked(NetworkService.updateIntegrationSettings).mockResolvedValueOnce({
      agency: 'lff',
      office_ids: ['M3', 'M4'],
      limit: 2.5,
      enabled: true,
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() =>
      expect(NetworkService.updateIntegrationSettings).toHaveBeenCalledWith(
        'org-1',
        'property-listing',
        { agency: 'lff', office_ids: ['M3', 'M4'], limit: 2.5, enabled: true }
      )
    );
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith('Settings saved.')
    );
    expect(
      (screen.getByLabelText('Office IDs') as HTMLTextAreaElement).value
    ).toBe('M3\nM4');
  });

  it('shows field errors', async () => {
    renderDialog();
    await waitFor(() => screen.getByText('Property listings'));

    vi.mocked(NetworkService.updateIntegrationSettings).mockRejectedValueOnce(
      new HttpError('Unprocessable', 422, { agency: 'required' })
    );
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe('Required.')
    );
    expect(toastSpies.error).toHaveBeenCalledWith(
      'Check the highlighted fields.'
    );

    vi.mocked(NetworkService.updateIntegrationSettings).mockRejectedValueOnce(
      new Error('offline')
    );
    fireEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        "Couldn't save the settings: offline"
      )
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('removes settings', async () => {
    renderDialog();
    await waitFor(() => screen.getByText('Remove settings'));

    vi.mocked(NetworkService.deleteIntegrationSettings).mockResolvedValueOnce();
    fireEvent.click(screen.getByText('Remove settings'));
    await waitFor(() =>
      expect(toastSpies.success).toHaveBeenCalledWith('Settings removed.')
    );
    expect(NetworkService.deleteIntegrationSettings).toHaveBeenCalledWith(
      'org-1',
      'property-listing'
    );
    expect((screen.getByLabelText('Agency *') as HTMLInputElement).value).toBe(
      ''
    );
    expect(screen.queryByText('Remove settings')).toBeNull();
  });

  it('reports removal errors', async () => {
    renderDialog();
    await waitFor(() => screen.getByText('Remove settings'));
    vi.mocked(NetworkService.deleteIntegrationSettings).mockRejectedValueOnce(
      new Error('denied')
    );
    fireEvent.click(screen.getByText('Remove settings'));
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        "Couldn't save the settings: denied"
      )
    );
  });

  it('explains when no widget uses organization settings', async () => {
    vi.mocked(NetworkService.listIntegrationSettings).mockResolvedValueOnce([]);
    renderDialog();
    await waitFor(() =>
      expect(
        screen.getByText(
          'No widget in this network uses organization settings.'
        )
      ).toBeTruthy()
    );
  });

  it('reports loading errors and closes', async () => {
    vi.mocked(NetworkService.listIntegrationSettings).mockRejectedValueOnce(
      new Error('x')
    );
    const onClose = vi.fn();
    renderDialog(onClose);
    await waitFor(() =>
      expect(toastSpies.error).toHaveBeenCalledWith(
        "Couldn't load the integration settings."
      )
    );
  });
});

describe('integration settings helpers', () => {
  it('orders fields and converts values both ways', () => {
    expect(orderedFields(listing.schema).map(([name]) => name)).toEqual([
      'agency',
      'office_ids',
      'enabled',
      'limit',
    ]);

    const values = toFormValues({
      ...listing,
      settings: { agency: 'fb', limit: 3, enabled: true },
    });
    expect(values).toEqual({
      agency: 'fb',
      office_ids: '',
      enabled: true,
      limit: '3',
    });

    expect(
      toSettings(listing.schema, {
        agency: 'fb',
        office_ids: 'a\n b',
        limit: 'ten',
        enabled: false,
      })
    ).toEqual({
      agency: 'fb',
      office_ids: ['a', 'b'],
      limit: 'ten',
      enabled: false,
    });

    const commaValues = ['North, East', 'South'];
    const commaForm = toFormValues({
      ...listing,
      settings: { ...listing.settings, office_ids: commaValues },
    });
    expect(commaForm.office_ids).toBe(commaValues.join('\n'));
    expect(toSettings(listing.schema, commaForm).office_ids).toEqual(
      commaValues
    );

    expect(toSettings(listing.schema, {})).toEqual({
      agency: '',
      office_ids: [],
      enabled: false,
    });
  });
});
