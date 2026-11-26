import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@solidjs/testing-library';
import { DeleteOrganization } from './delete-organization';
import { OrganizationsService } from '../../services/organizations.service';
import { setStore } from '../../store';

const navigate = vi.fn();

vi.mock('@solidjs/router', () => ({ useNavigate: () => navigate }));
vi.mock('../../services/organizations.service');
vi.mock('../../components/auth', () => ({ getUser: () => ({ id: 'user-1' }) }));
vi.mock('../../store', () => ({ store: {}, setStore: vi.fn() }));
vi.mock('../../i18n', () => ({
  useI18n: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.name ? `${key}:${params.name}` : key,
  }),
}));

const mockToast = { success: vi.fn(), error: vi.fn() };

vi.mock('@castmill/ui-common', async () => {
  const actual = await vi.importActual('@castmill/ui-common');
  return { ...actual, useToast: () => mockToast };
});

const openDialog = () => {
  render(() => (
    <DeleteOrganization organizationId="org-1" organizationName="Corner Shop" />
  ));
  fireEvent.click(screen.getByText('organization.delete.action'));
  return {
    input: screen.getByLabelText('organization.delete.typeName:Corner Shop'),
    confirm: () =>
      screen.getByText('organization.delete.confirmAction').closest('button')!,
  };
};

describe('DeleteOrganization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('only enables deletion once the exact name is typed', () => {
    const { input, confirm } = openDialog();
    expect(confirm()).toBeDisabled();

    fireEvent.input(input, { target: { value: 'corner shop' } });
    expect(confirm()).toBeDisabled();

    fireEvent.input(input, { target: { value: 'Corner Shop' } });
    expect(confirm()).not.toBeDisabled();
  });

  it('deletes, reloads the organizations and opens the next one', async () => {
    vi.mocked(OrganizationsService.deleteOrganization).mockResolvedValue(
      undefined
    );
    vi.mocked(OrganizationsService.getAll).mockResolvedValue([
      { id: 'org-2', name: 'Other' } as any,
    ]);

    const { input, confirm } = openDialog();
    fireEvent.input(input, { target: { value: 'Corner Shop' } });
    fireEvent.click(confirm());

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/org/org-2', { replace: true })
    );
    expect(OrganizationsService.deleteOrganization).toHaveBeenCalledWith(
      'org-1',
      'Corner Shop'
    );
    expect(setStore).toHaveBeenCalledWith(
      'organizations',
      expect.objectContaining({ selectedId: null })
    );
    expect(mockToast.success).toHaveBeenCalled();
  });

  it('goes to the start page when no organization is left', async () => {
    vi.mocked(OrganizationsService.deleteOrganization).mockResolvedValue(
      undefined
    );
    vi.mocked(OrganizationsService.getAll).mockResolvedValue([]);

    const { input, confirm } = openDialog();
    fireEvent.input(input, { target: { value: 'Corner Shop' } });
    fireEvent.click(confirm());

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    );
  });

  it('leaves the deleted organization even if reloading fails', async () => {
    vi.mocked(OrganizationsService.deleteOrganization).mockResolvedValue(
      undefined
    );
    vi.mocked(OrganizationsService.getAll).mockRejectedValue(
      new Error('offline')
    );

    const { input, confirm } = openDialog();
    fireEvent.input(input, { target: { value: 'Corner Shop' } });
    fireEvent.click(confirm());

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/', { replace: true })
    );
    expect(setStore).toHaveBeenCalledWith(
      'organizations',
      expect.objectContaining({ selectedId: null })
    );
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it('cannot be dismissed while deleting', async () => {
    let finish: () => void = () => {};
    vi.mocked(OrganizationsService.deleteOrganization).mockReturnValue(
      new Promise<void>((resolve) => (finish = resolve))
    );
    vi.mocked(OrganizationsService.getAll).mockResolvedValue([]);

    const { input, confirm } = openDialog();
    fireEvent.input(input, { target: { value: 'Corner Shop' } });
    fireEvent.click(confirm());
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.getByText('organization.delete.deleting')
    ).toBeInTheDocument();
    finish();
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  it('explains why the server refused', async () => {
    vi.mocked(OrganizationsService.deleteOrganization).mockRejectedValue(
      Object.assign(new Error('refused'), { code: 'has_child_organizations' })
    );

    const { input, confirm } = openDialog();
    fireEvent.input(input, { target: { value: 'Corner Shop' } });
    fireEvent.click(confirm());

    await waitFor(() =>
      expect(mockToast.error).toHaveBeenCalledWith(
        'organization.delete.errorChildren'
      )
    );
    expect(navigate).not.toHaveBeenCalled();
  });
});
