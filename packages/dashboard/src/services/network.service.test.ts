import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpError } from '@castmill/ui-common';
import { NetworkService } from './network.service';

// Mock the auth module to prevent side effects (setStore) during test imports
vi.mock('../components/auth', () => ({
  authFetch: vi.fn((...args: any[]) => (global.fetch as any)(...args)),
  getAuthToken: vi.fn(() => null),
  getUser: vi.fn(() => ({ id: 'test-user' })),
  checkAuth: vi.fn(() => true),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('NetworkService', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  describe('checkAdminStatus', () => {
    it('returns admin status for network admin', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            is_admin: true,
            network_id: 'network-123',
            access: 'admin',
          }),
      });

      const result = await NetworkService.checkAdminStatus();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/admin-status'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual({
        is_admin: true,
        network_id: 'network-123',
        access: 'admin',
      });
    });

    it('returns non-admin status for regular user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            is_admin: false,
            network_id: 'network-123',
          }),
      });

      const result = await NetworkService.checkAdminStatus();

      expect(result).toEqual({
        is_admin: false,
        network_id: 'network-123',
      });
    });
  });

  describe('getSettings', () => {
    it('returns network settings', async () => {
      const mockSettings = {
        id: 'network-123',
        name: 'Test Network',
        domain: 'test.example.com',
        email: 'support@test.com',
        logo: 'https://example.com/logo.png',
        copyright: '© 2025 Test',
        invitation_only: false,
        invitation_only_org_admins: true,
        inserted_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSettings),
      });

      const result = await NetworkService.getSettings();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/settings'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockSettings);
    });

    it('throws error for non-admin user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: 'You must be a network admin to access this resource',
          }),
      });

      await expect(NetworkService.getSettings()).rejects.toThrow();
    });
  });

  describe('updateSettings', () => {
    it('updates network settings', async () => {
      const updates = {
        name: 'Updated Network',
        email: 'updated@test.com',
        invitation_only: true,
      };

      const mockResponse = {
        ...updates,
        id: 'network-123',
        domain: 'test.example.com',
        logo: '',
        copyright: '',
        invitation_only_org_admins: false,
        inserted_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await NetworkService.updateSettings(updates);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/settings'),
        expect.objectContaining({
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ network: updates }),
        })
      );
      expect(result.name).toBe('Updated Network');
    });

    it('throws error for non-admin user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: 'You must be a network admin to update network settings',
          }),
      });

      await expect(
        NetworkService.updateSettings({ name: 'Hacked' })
      ).rejects.toThrow();
    });
  });

  describe('getStats', () => {
    it('returns network statistics', async () => {
      const mockStats = {
        organizations_count: 5,
        users_count: 25,
        devices_count: 100,
        teams_count: 10,
        total_storage_bytes: 1073741824,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockStats),
      });

      const result = await NetworkService.getStats();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/stats'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result).toEqual(mockStats);
    });
  });

  describe('widget access', () => {
    const widget = {
      id: 21,
      name: 'Weather',
      description: 'Forecast',
      slug: 'weather',
      icon: '/widgets/weather/icon.svg',
      small_icon: null,
      kind: 'system',
      access: 'selected',
      enabled_count: 1,
      eligible_count: 3,
      organizations_count: 3,
      in_use_count: 0,
      core: false,
      platform_restricted: false,
    };

    const ok = (body: unknown) => ({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
    });

    it('lists widgets with filters as query parameters', async () => {
      const result = {
        data: [widget],
        summary: { all: 0, selected: 1, hidden: 0, total: 1 },
        organizations_count: 3,
        pagination: { page: 2, page_size: 50, total_count: 51, total_pages: 2 },
      };
      mockFetch.mockResolvedValueOnce(ok(result));

      await expect(
        NetworkService.listWidgetAccess({
          page: 2,
          pageSize: 50,
          search: 'wea',
          kind: 'system',
          access: 'selected',
        })
      ).resolves.toEqual(result);

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/dashboard/network/widgets?');
      expect(url).toContain('page=2');
      expect(url).toContain('page_size=50');
      expect(url).toContain('search=wea');
      expect(url).toContain('kind=system');
      expect(url).toContain('access=selected');
    });

    it('omits empty filters', async () => {
      mockFetch.mockResolvedValueOnce(ok({ data: [] }));

      await NetworkService.listWidgetAccess({ search: '' });

      expect(mockFetch.mock.calls[0][0]).toMatch(
        /\/dashboard\/network\/widgets$/
      );
    });

    it("lists a widget's organizations", async () => {
      mockFetch.mockResolvedValueOnce(ok({ data: [] }));

      await NetworkService.listWidgetOrganizations(21, {
        page: 1,
        search: 'acme',
        status: 'disabled',
      });

      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain('/dashboard/network/widgets/21/organizations?');
      expect(url).toContain('search=acme');
      expect(url).toContain('status=disabled');
    });

    it('sets the access mode', async () => {
      mockFetch.mockResolvedValueOnce(ok(widget));

      await expect(
        NetworkService.setWidgetAccess(21, 'hidden')
      ).resolves.toEqual(widget);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/widgets/21/access'),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ access: 'hidden' }),
        })
      );
    });

    it('updates organizations by id or by search', async () => {
      mockFetch.mockResolvedValue(ok(widget));

      await NetworkService.updateWidgetOrganizations(21, {
        disable: ['org-1'],
      });
      await NetworkService.updateWidgetOrganizations(21, {
        all_matching: true,
        enabled: true,
        search: 'acme',
      });

      expect(mockFetch.mock.calls[0][1]).toEqual(
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ disable: ['org-1'] }),
        })
      );
      expect(mockFetch.mock.calls[1][1].body).toBe(
        JSON.stringify({ all_matching: true, enabled: true, search: 'acme' })
      );
    });

    it('rejects with the organizations that still use the widget', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        statusText: 'Conflict',
        json: () =>
          Promise.resolve({
            error: 'in use',
            organizations: [{ id: 'org-1', name: 'Acme' }],
          }),
      });

      const error = await NetworkService.setWidgetAccess(21, 'hidden').catch(
        (err) => err
      );

      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(409);
      expect(error.details).toEqual({
        organizations: [{ id: 'org-1', name: 'Acme' }],
      });
    });

    it('rejects other errors with their message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        statusText: 'Unprocessable',
        json: () =>
          Promise.resolve({ error: 'Core widgets are always available' }),
      });

      await expect(
        NetworkService.updateWidgetOrganizations(1, { disable: ['org-1'] })
      ).rejects.toThrow('Core widgets are always available');
    });
  });

  describe('listOrganizations', () => {
    it('returns list of organizations', async () => {
      const mockOrganizations = {
        data: [
          {
            id: 'org-1',
            name: 'Organization 1',
            inserted_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'org-2',
            name: 'Organization 2',
            inserted_at: '2024-01-02T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          page_size: 10,
          total_count: 2,
          total_pages: 1,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockOrganizations),
      });

      const result = await NetworkService.listOrganizations();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/organizations'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result.data).toHaveLength(2);
      expect(result.data[0].name).toBe('Organization 1');
    });

    it('throws error for non-admin user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: 'You must be a network admin to access this resource',
          }),
      });

      await expect(NetworkService.listOrganizations()).rejects.toThrow();
    });
  });

  describe('createOrganization', () => {
    it('creates a new organization', async () => {
      const mockOrg = {
        id: 'org-new',
        name: 'New Organization',
        inserted_at: '2024-01-03T00:00:00Z',
        updated_at: '2024-01-03T00:00:00Z',
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(mockOrg),
      });

      const result =
        await NetworkService.createOrganization('New Organization');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/organizations'),
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ organization: { name: 'New Organization' } }),
        })
      );
      expect(result.name).toBe('New Organization');
      expect(result.id).toBe('org-new');
    });

    it('throws error for non-admin user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: 'You must be a network admin to create organizations',
          }),
      });

      await expect(
        NetworkService.createOrganization('Unauthorized Org')
      ).rejects.toThrow();
    });

    it('throws validation error for empty name', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: () =>
          Promise.resolve({
            errors: { name: ["can't be blank"] },
          }),
      });

      await expect(NetworkService.createOrganization('')).rejects.toThrow();
    });
  });

  describe('listUsers', () => {
    it('returns paginated list of users', async () => {
      const mockResponse = {
        data: [
          {
            id: 'user-1',
            name: 'User 1',
            email: 'user1@example.com',
            inserted_at: '2024-01-01T00:00:00Z',
          },
          {
            id: 'user-2',
            name: 'User 2',
            email: 'user2@example.com',
            inserted_at: '2024-01-02T00:00:00Z',
          },
        ],
        pagination: {
          page: 1,
          page_size: 50,
          total_count: 2,
          total_pages: 1,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await NetworkService.listUsers();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/users'),
        expect.objectContaining({
          method: 'GET',
        })
      );
      expect(result.data).toHaveLength(2);
      expect(result.data[0].email).toBe('user1@example.com');
      expect(result.pagination.total_count).toBe(2);
    });

    it('throws error for non-admin user', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () =>
          Promise.resolve({
            error: 'You must be a network admin to access this resource',
          }),
      });

      await expect(NetworkService.listUsers()).rejects.toThrow();
    });
  });

  describe('integration settings', () => {
    const reply = (status: number, body?: unknown) => ({
      ok: status < 300,
      status,
      statusText: 'Status',
      json: () =>
        body === undefined
          ? Promise.reject(new Error('no body'))
          : Promise.resolve(body),
    });

    it('lists, saves and removes settings', async () => {
      mockFetch.mockResolvedValueOnce(reply(200, { data: [{ key: 'k' }] }));
      expect(await NetworkService.listIntegrationSettings('org-1')).toEqual([
        { key: 'k' },
      ]);
      expect(mockFetch.mock.calls.at(-1)[0]).toContain(
        '/dashboard/network/organizations/org-1/integration-settings'
      );

      mockFetch.mockResolvedValueOnce(
        reply(200, { data: { key: 'a b', settings: { agency: 'fb' } } })
      );
      expect(
        await NetworkService.updateIntegrationSettings('org-1', 'a b', {
          agency: 'fb',
        })
      ).toEqual({ agency: 'fb' });
      const [url, init] = mockFetch.mock.calls.at(-1);
      expect(url).toContain('/integration-settings/a%20b');
      expect(init.method).toBe('PUT');
      expect(JSON.parse(init.body)).toEqual({ settings: { agency: 'fb' } });

      mockFetch.mockResolvedValueOnce(reply(204, undefined));
      await NetworkService.deleteIntegrationSettings('org-1', 'k');
      expect(mockFetch.mock.calls.at(-1)[1].method).toBe('DELETE');
    });

    it('reports invalid fields', async () => {
      mockFetch.mockResolvedValueOnce(
        reply(422, { errors: { agency: 'required' } })
      );
      const error = await NetworkService.updateIntegrationSettings(
        'org-1',
        'k',
        {}
      ).catch((e) => e);
      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(422);
      expect(error.details).toEqual({ agency: 'required' });

      mockFetch.mockResolvedValueOnce(reply(422, undefined));
      const empty = await NetworkService.updateIntegrationSettings(
        'org-1',
        'k',
        {}
      ).catch((e) => e);
      expect(empty.details).toEqual({});

      mockFetch.mockResolvedValueOnce(reply(404, { error: 'Unknown' }));
      await expect(
        NetworkService.updateIntegrationSettings('org-1', 'k', {})
      ).rejects.toThrow('Unknown');
    });
  });

  describe('widget packages', () => {
    const response = (status: number, body: unknown, headers = {}) => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 409 ? 'Conflict' : 'OK',
      headers: new Headers(headers),
      json: () => Promise.resolve(body),
      blob: () => Promise.resolve(new Blob(['zip'])),
    });

    it('uploads a package as multipart form data', async () => {
      const result = { data: { id: 7 }, created: true, version: 1 };
      mockFetch.mockResolvedValueOnce(response(201, result));
      const file = new File(['zip'], 'listing.zip');

      await expect(NetworkService.uploadWidget(file)).resolves.toEqual(result);

      const [url, init] = mockFetch.mock.calls[0];
      expect(url).toMatch(/\/dashboard\/network\/widgets$/);
      expect(init.method).toBe('POST');
      expect((init.body as FormData).get('widget')).toBe(file);
    });

    it('rejects uploads with the reason the package was refused', async () => {
      const items = [{ playlist_name: 'Lobby', error: 'Field x is required' }];
      mockFetch.mockResolvedValueOnce(
        response(409, {
          code: 'incompatible',
          error: 'This version would make saved playlist items invalid',
          items,
          total: 4,
        })
      );
      const error = await NetworkService.uploadWidget(
        new File([''], 'x.zip')
      ).catch((err) => err);

      expect(error).toBeInstanceOf(HttpError);
      expect(error.status).toBe(409);
      expect(error.details).toEqual({
        code: 'incompatible',
        fetcher: undefined,
        errors: undefined,
        items,
        total: 4,
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: 'Bad Gateway',
        json: () => Promise.reject(new Error('not json')),
      });
      const gateway = await NetworkService.uploadWidget(
        new File([''], 'x.zip')
      ).catch((err) => err);
      expect(gateway.message).toBe('Bad Gateway');
      expect(gateway.details.code).toBe('invalid_package');
    });

    it('lists and downloads package versions', async () => {
      const versions = [{ version: 2, filename: 'listing.zip' }];
      mockFetch.mockResolvedValueOnce(response(200, { data: versions }));
      await expect(NetworkService.listWidgetPackages(7)).resolves.toEqual(
        versions
      );
      expect(mockFetch.mock.calls[0][0]).toMatch(
        /\/dashboard\/network\/widgets\/7\/packages$/
      );

      mockFetch.mockResolvedValueOnce(
        response(200, null, {
          'content-disposition': 'attachment; filename="listing-v2.zip"',
        })
      );
      const download = await NetworkService.downloadWidgetPackage(7, 2);
      expect(download.filename).toBe('listing-v2.zip');
      expect(download.blob).toBeInstanceOf(Blob);
      expect(mockFetch.mock.calls[1][0]).toMatch(/\/widgets\/7\/packages\/2$/);

      mockFetch.mockResolvedValueOnce(response(200, null));
      expect((await NetworkService.downloadWidgetPackage(7, 3)).filename).toBe(
        'widget-v3'
      );

      mockFetch.mockResolvedValueOnce(response(404, null));
      await expect(
        NetworkService.downloadWidgetPackage(7, 9)
      ).rejects.toBeInstanceOf(HttpError);
    });

    it('deletes widgets, rejecting those still in use', async () => {
      mockFetch.mockResolvedValueOnce(response(204, null));
      await expect(NetworkService.deleteWidget(7)).resolves.toBeUndefined();
      expect(mockFetch.mock.calls[0][1].method).toBe('DELETE');

      mockFetch.mockResolvedValueOnce(
        response(409, {
          error: 'in use',
          organizations: [{ id: 'org-1', name: 'Acme' }],
        })
      );
      const error = await NetworkService.deleteWidget(7).catch((err) => err);
      expect(error.status).toBe(409);
      expect(error.details.organizations).toEqual([
        { id: 'org-1', name: 'Acme' },
      ]);
    });
  });
});
