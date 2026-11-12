import { cleanup, render, screen, waitFor } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../../i18n';
import TagsPage from './tags-page';
import { setStore } from '../../store/store';

const mocks = vi.hoisted(() => ({
  getQuotaUsage: vi.fn(),
  listTags: vi.fn(),
  listTagGroups: vi.fn(),
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../services/quotas.service', () => ({
  QuotasService: { getQuotaUsage: mocks.getQuotaUsage },
}));

vi.mock('../../store/store', async () => {
  const { createStore } = await import('solid-js/store');
  const [store, setStore] = createStore({
    organizations: { selectedId: 'org-1' },
  });
  return { store, setStore };
});

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasAnyRole: () => true,
  }),
}));

vi.mock('@castmill/ui-common', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@castmill/ui-common')>();
  return {
    ...actual,
    TagsService: class {
      listTags = mocks.listTags;
      listTagGroups = mocks.listTagGroups;
    },
    useToast: () => mocks.toast,
  };
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('TagsPage quota loading', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setStore('organizations', 'selectedId', 'org-1');
    mocks.listTags.mockResolvedValue([]);
    mocks.listTagGroups.mockResolvedValue([]);
  });

  afterEach(cleanup);

  it('ignores quota responses from a previously selected organization', async () => {
    const org1Quota = deferred<{
      tags: { used: number; total: number };
      tag_groups: { used: number; total: number };
    }>();
    const org2Quota = deferred<{
      tags: { used: number; total: number };
      tag_groups: { used: number; total: number };
    }>();
    const refreshedOrg1Quota = deferred<{
      tags: { used: number; total: number };
      tag_groups: { used: number; total: number };
    }>();
    const oldResponseSettled = vi.fn();
    const org2ResponseSettled = vi.fn();
    org1Quota.promise.then(oldResponseSettled);
    org2Quota.promise.then(org2ResponseSettled);
    mocks.getQuotaUsage
      .mockReturnValueOnce(org1Quota.promise)
      .mockReturnValueOnce(org2Quota.promise)
      .mockReturnValueOnce(refreshedOrg1Quota.promise);

    render(() => (
      <I18nProvider>
        <TagsPage />
      </I18nProvider>
    ));

    await waitFor(() => expect(mocks.getQuotaUsage).toHaveBeenCalledTimes(1));
    setStore('organizations', 'selectedId', 'org-2');
    await waitFor(() => expect(mocks.getQuotaUsage).toHaveBeenCalledTimes(2));
    setStore('organizations', 'selectedId', 'org-1');
    await waitFor(() => expect(mocks.getQuotaUsage).toHaveBeenCalledTimes(3));

    refreshedOrg1Quota.resolve({
      tags: { used: 0, total: 10 },
      tag_groups: { used: 0, total: 10 },
    });
    const createTagButton = await screen.findByRole('button', {
      name: 'Create Tag',
    });
    await waitFor(() => expect(createTagButton).toBeEnabled());

    org2Quota.resolve({
      tags: { used: 10, total: 10 },
      tag_groups: { used: 10, total: 10 },
    });
    await waitFor(() => expect(org2ResponseSettled).toHaveBeenCalled());
    org1Quota.resolve({
      tags: { used: 10, total: 10 },
      tag_groups: { used: 10, total: 10 },
    });
    await waitFor(() => expect(oldResponseSettled).toHaveBeenCalled());

    expect(createTagButton).toBeEnabled();
  });

  it('clears tag and group quotas when the organization changes', async () => {
    mocks.getQuotaUsage
      .mockResolvedValueOnce({
        tags: { used: 10, total: 10 },
        tag_groups: { used: 10, total: 10 },
      })
      .mockRejectedValueOnce(new Error('quota unavailable'));

    render(() => (
      <I18nProvider>
        <TagsPage />
      </I18nProvider>
    ));

    const createTagButton = await screen.findByRole('button', {
      name: 'Create Tag',
    });
    const createGroupButton = screen.getByRole('button', { name: 'Add Group' });
    await waitFor(() => {
      expect(createTagButton).toBeDisabled();
      expect(createGroupButton).toBeDisabled();
    });

    setStore('organizations', 'selectedId', 'org-2');

    await waitFor(() => {
      expect(createTagButton).toBeEnabled();
      expect(createGroupButton).toBeEnabled();
    });
  });
});
