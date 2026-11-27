import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  UserService,
  ChildOrganizationsError,
  SoleAdministratorError,
  AccountDeletionRefusedError,
} from './user.service';

vi.mock('../components/auth', () => ({
  authFetch: vi.fn((...args: any[]) => (global.fetch as any)(...args)),
}));

vi.mock('../env', () => ({ baseUrl: 'https://api.example.com' }));

global.fetch = vi.fn();

const refused = (body: unknown) => ({
  ok: false,
  status: 422,
  json: async () => body,
});

describe('UserService.deleteAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports an organization with child organizations', async () => {
    (global.fetch as any).mockResolvedValue(
      refused({
        error: 'has_child_organizations',
        organization_name: 'Parent Org',
      })
    );

    const error = await UserService.deleteAccount('u1').catch((e) => e);

    expect(error).toBeInstanceOf(ChildOrganizationsError);
    expect(error.organizationName).toBe('Parent Org');
  });

  it('reports a sole administrator', async () => {
    (global.fetch as any).mockResolvedValue(
      refused({ error: 'sole_administrator', organization_name: 'Shop' })
    );

    await expect(UserService.deleteAccount('u1')).rejects.toBeInstanceOf(
      SoleAdministratorError
    );
  });

  it('reports the last admin of a network', async () => {
    (global.fetch as any).mockResolvedValue(
      refused({ error: 'last_network_admin', network_name: 'Castmill' })
    );

    const error = await UserService.deleteAccount('u1').catch((e) => e);

    expect(error).toBeInstanceOf(AccountDeletionRefusedError);
    expect(error.reason).toBe('last_network_admin');
    expect(error.networkName).toBe('Castmill');
  });

  it('reports a root admin', async () => {
    (global.fetch as any).mockResolvedValue(refused({ error: 'root_admin' }));

    const error = await UserService.deleteAccount('u1').catch((e) => e);

    expect(error).toBeInstanceOf(AccountDeletionRefusedError);
    expect(error.reason).toBe('root_admin');
  });
});
