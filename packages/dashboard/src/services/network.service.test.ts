import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NetworkService } from './network.service';

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
          credentials: 'include',
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
          credentials: 'include',
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
          credentials: 'include',
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
          credentials: 'include',
        })
      );
      expect(result).toEqual(mockStats);
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
          credentials: 'include',
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
          credentials: 'include',
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
    it('returns list of users', async () => {
      const mockUsers = [
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
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockUsers),
      });

      const result = await NetworkService.listUsers();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/dashboard/network/users'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0].email).toBe('user1@example.com');
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
});
