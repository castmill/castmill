import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'solid-js';
import { usePermissions } from './usePermissions';
import { store, setStore } from '../store';
import {
  fetchPermissions,
  PermissionsResponse,
} from '../services/permissions.service';

vi.mock('../services/permissions.service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/permissions.service')>()),
  fetchPermissions: vi.fn(),
}));

const response = (role: PermissionsResponse['role']): PermissionsResponse => ({
  role,
  permissions: {
    playlists: [],
    medias: [],
    channels: [],
    automations: [],
    devices: [],
    teams: ['list'],
    widgets: [],
    layouts: [],
    feeds: [],
    tags: [],
    organizations: [],
  },
  resources: ['teams'],
});

const deferred = () => {
  let resolve!: (value: PermissionsResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<PermissionsResponse>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('organization permission request ordering', () => {
  let dispose: () => void;
  let permissions: ReturnType<typeof usePermissions>;

  beforeEach(() => {
    vi.clearAllMocks();
    createRoot((cleanup) => {
      dispose = cleanup;
      permissions = usePermissions();
    });
    setStore('organizations', 'selectedId', 'org-1');
    setStore('permissions', {
      loaded: true,
      loading: false,
      role: 'admin',
      matrix: response('admin').permissions,
    });
  });

  afterEach(() => {
    dispose();
    vi.restoreAllMocks();
  });

  it('clears the previous organization permissions while loading', async () => {
    const request = deferred();
    vi.mocked(fetchPermissions).mockReturnValueOnce(request.promise);
    setStore('organizations', 'selectedId', 'org-2');
    const loading = permissions.loadPermissions('org-2');
    expect(store.permissions).toMatchObject({
      loaded: false,
      loading: true,
    });
    expect(store.permissions.role).toBeUndefined();
    expect(store.permissions.matrix).toBeUndefined();
    request.resolve(response('guest'));
    await loading;
    expect(permissions.getUserRole()).toBe('guest');
    expect(permissions.isLoaded()).toBe(true);
    expect(permissions.isLoading()).toBe(false);
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores a late old-organization %s',
    async (outcome) => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const oldRequest = deferred();
      vi.mocked(fetchPermissions)
        .mockReturnValueOnce(oldRequest.promise)
        .mockResolvedValueOnce(response('guest'));
      const oldLoading = permissions.loadPermissions('org-1');
      setStore('organizations', 'selectedId', 'org-2');
      await permissions.loadPermissions('org-2');
      if (outcome === 'resolve') oldRequest.resolve(response('admin'));
      else oldRequest.reject(new Error('Old organization failed'));
      await oldLoading;
      expect(store.permissions).toMatchObject({
        role: 'guest',
        loaded: true,
        loading: false,
      });
    }
  );

  it('ignores the first response when switching A to B to A', async () => {
    const oldRequest = deferred();
    vi.mocked(fetchPermissions)
      .mockReturnValueOnce(oldRequest.promise)
      .mockResolvedValueOnce(response('guest'))
      .mockResolvedValueOnce(response('member'));
    const oldLoading = permissions.loadPermissions('org-1');
    setStore('organizations', 'selectedId', 'org-2');
    await permissions.loadPermissions('org-2');
    setStore('organizations', 'selectedId', 'org-1');
    await permissions.loadPermissions('org-1');
    oldRequest.resolve(response('admin'));
    await oldLoading;
    expect(store.permissions.role).toBe('member');
  });

  it('logs a current failure and leaves permissions unavailable', async () => {
    const error = new Error('Current organization failed');
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(fetchPermissions).mockRejectedValueOnce(error);
    await permissions.loadPermissions('org-1');
    expect(log).toHaveBeenCalledWith('Failed to load permissions:', error);
    expect(store.permissions).toMatchObject({
      loaded: false,
      loading: false,
    });
    expect(store.permissions.role).toBeUndefined();
    expect(store.permissions.matrix).toBeUndefined();
  });

  it('does not publish a response after the selection has been cleared', async () => {
    const request = deferred();
    vi.mocked(fetchPermissions).mockReturnValueOnce(request.promise);
    const loading = permissions.loadPermissions('org-1');
    setStore('organizations', 'selectedId', null);
    request.resolve(response('admin'));
    await loading;
    expect(store.permissions.role).toBeUndefined();
    expect(store.permissions.matrix).toBeUndefined();
  });

  it('checks roles and actions from the current permission matrix', async () => {
    vi.mocked(fetchPermissions).mockResolvedValueOnce(response('member'));
    await permissions.loadPermissions('org-1');
    expect(permissions.canPerformAction('teams', 'list')).toBe(true);
    expect(permissions.canPerformAction('teams', 'delete')).toBe(false);
    expect(permissions.getAllowedActions('teams')).toEqual(['list']);
    expect(permissions.hasRole('member')).toBe(true);
    expect(permissions.hasAnyRole(['admin', 'member'])).toBe(true);
    setStore('permissions', 'role', undefined);
    expect(permissions.hasAnyRole(['admin'])).toBe(false);
    await permissions.loadPermissions('');
    expect(fetchPermissions).toHaveBeenCalledTimes(1);
  });
});
