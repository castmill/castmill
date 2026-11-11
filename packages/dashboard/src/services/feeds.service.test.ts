import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FeedsError, FeedsService } from './feeds.service';

vi.mock('../components/auth', () => ({
  authFetch: vi.fn((...args: any[]) => (global.fetch as any)(...args)),
}));

vi.mock('../env', () => ({ baseUrl: 'https://api.example.com' }));

global.fetch = vi.fn();

const reply = (body: unknown, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: 'Status text',
  json: async () => {
    if (body === undefined) throw new Error('no body');
    return body;
  },
});

const base = 'https://api.example.com/dashboard/organizations/org-1/feeds';
const lastCall = () => (global.fetch as any).mock.calls.at(-1);

describe('FeedsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists feeds with paging and search', async () => {
    (global.fetch as any).mockResolvedValue(reply({ data: [], count: 0 }));

    await FeedsService.list('org-1');
    expect(lastCall()[0]).toBe(base);

    await FeedsService.list('org-1', { page: 2, pageSize: 5, search: 'po' });
    expect(lastCall()[0]).toBe(`${base}?page=2&page_size=5&search=po`);
  });

  it('reads, creates, updates and deletes feeds', async () => {
    (global.fetch as any).mockResolvedValue(reply({ data: { id: 'f1' } }));

    expect(await FeedsService.get('org-1', 'f1')).toEqual({ id: 'f1' });
    expect(lastCall()[0]).toBe(`${base}/f1`);

    await FeedsService.create('org-1', { name: 'Posts' });
    expect(lastCall()[1].method).toBe('POST');
    expect(JSON.parse(lastCall()[1].body)).toEqual({ feed: { name: 'Posts' } });

    await FeedsService.update('org-1', 'f1', { keep: 3 });
    expect(lastCall()[1].method).toBe('PATCH');

    (global.fetch as any).mockResolvedValueOnce(reply(undefined, 204));
    expect(await FeedsService.remove('org-1', 'f1')).toBeUndefined();
    expect(lastCall()[1].method).toBe('DELETE');
  });

  it('manages entries', async () => {
    (global.fetch as any).mockResolvedValue(
      reply({ data: { entries: [] }, version: 2 })
    );

    await FeedsService.data('org-1', 'f1');
    expect(lastCall()[0]).toBe(`${base}/f1/entries`);

    await FeedsService.sendTest('org-1', 'f1', 'list', { title: 'a' });
    expect(JSON.parse(lastCall()[1].body)).toEqual({ entry: { title: 'a' } });

    await FeedsService.sendTest('org-1', 'f1', 'document', { open: '9' });
    expect(JSON.parse(lastCall()[1].body)).toEqual({
      document: { open: '9' },
    });

    (global.fetch as any).mockResolvedValue(reply(undefined, 204));
    await FeedsService.deleteEntry('org-1', 'f1', 'e1');
    expect(lastCall()[0]).toBe(`${base}/f1/entries/e1`);
    await FeedsService.clear('org-1', 'f1');
    expect(lastCall()[0]).toBe(`${base}/f1/entries`);
  });

  it('manages tokens', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      reply({ data: [{ id: 't1' }] })
    );
    expect(await FeedsService.tokens('org-1', 'f1')).toEqual([{ id: 't1' }]);

    (global.fetch as any).mockResolvedValueOnce(
      reply({ data: { id: 't2' }, secret: 'cmfeed_x' }, 201)
    );
    expect(await FeedsService.createToken('org-1', 'f1', 'Make')).toEqual({
      token: { id: 't2' },
      secret: 'cmfeed_x',
    });
    expect(JSON.parse(lastCall()[1].body)).toEqual({ name: 'Make' });

    (global.fetch as any).mockResolvedValueOnce(
      reply({ data: { id: 't2', revoked_at: 'now' } })
    );
    expect(await FeedsService.revokeToken('org-1', 'f1', 't2')).toEqual({
      id: 't2',
      revoked_at: 'now',
    });
    expect(lastCall()[0]).toBe(`${base}/f1/tokens/t2`);
  });

  it('lists and retries feed media', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      reply({ data: [{ id: 'm1' }], storage: 10 })
    );
    expect(await FeedsService.media('org-1', 'f1')).toEqual({
      data: [{ id: 'm1' }],
      storage: 10,
    });
    expect(lastCall()[0]).toBe(`${base}/f1/media`);

    (global.fetch as any).mockResolvedValueOnce(
      reply({ data: { id: 'm1', status: 'pending' } })
    );
    expect(await FeedsService.retryMedia('org-1', 'f1', 'm1')).toEqual({
      id: 'm1',
      status: 'pending',
    });
    expect(lastCall()[0]).toBe(`${base}/f1/media/m1/retry`);
    expect(lastCall()[1].method).toBe('POST');
  });

  it('reports server errors', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      reply({ error: 'quota_exceeded', message: 'Quota used up' }, 403)
    );
    const quota = await FeedsService.create('org-1', {}).catch((e) => e);
    expect(quota).toBeInstanceOf(FeedsError);
    expect(quota).toMatchObject({
      message: 'Quota used up',
      status: 403,
      code: 'quota_exceeded',
    });

    (global.fetch as any).mockResolvedValueOnce(
      reply({ errors: { name: ['has already been taken'] } }, 422)
    );
    await expect(FeedsService.create('org-1', {})).rejects.toMatchObject({
      message: 'name has already been taken',
      status: 422,
    });

    (global.fetch as any).mockResolvedValueOnce(
      reply({ error: 'The entry is too large' }, 422)
    );
    await expect(
      FeedsService.sendTest('org-1', 'f1', 'list', {})
    ).rejects.toMatchObject({ message: 'The entry is too large' });

    (global.fetch as any).mockResolvedValueOnce(reply(undefined, 500));
    await expect(FeedsService.get('org-1', 'f1')).rejects.toMatchObject({
      message: 'Status text',
      status: 500,
    });
  });
});
