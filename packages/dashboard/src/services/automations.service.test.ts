import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutomationsService, occurrenceToMs } from './automations.service';

vi.mock('../components/auth', () => ({
  authFetch: vi.fn((...args: any[]) => (global.fetch as any)(...args)),
}));

vi.mock('../env', () => ({ baseUrl: 'https://api.example.com' }));

global.fetch = vi.fn();

const okJson = (body: unknown, status = 200) => ({
  ok: true,
  status,
  json: async () => body,
});

const ORG = 'https://api.example.com/dashboard/organizations/org-1';

const automation = {
  id: 7,
  name: 'Spring offers',
  enabled: true,
  rules: [],
  devices: [],
  channels: [],
  warnings: [],
  next_firing: null,
};

const calls = () => (global.fetch as any).mock.calls;

describe('AutomationsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists automations with search and pagination', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      okJson({ data: [automation], count: 1 })
    );

    const result = await AutomationsService.list('org-1', {
      search: 'spring',
      page: 2,
      pageSize: 5,
    });

    expect(result).toEqual({ data: [automation], count: 1 });
    expect(calls()[0][0]).toBe(
      `${ORG}/automations?search=spring&page=2&page_size=5`
    );
    expect(calls()[0][1].method).toBe('GET');
  });

  it('lists with default pagination', async () => {
    (global.fetch as any).mockResolvedValueOnce(okJson({ data: [], count: 0 }));
    await AutomationsService.list('org-1');
    expect(calls()[0][0]).toBe(`${ORG}/automations?page=1&page_size=10`);
  });

  it('gets, creates, updates and deletes automations', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okJson({ data: automation }))
      .mockResolvedValueOnce(okJson({ data: automation }, 201))
      .mockResolvedValueOnce(okJson({ data: { ...automation, name: 'New' } }))
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

    expect(await AutomationsService.get('org-1', 7)).toEqual(automation);
    expect(
      await AutomationsService.create('org-1', { name: 'Spring offers' })
    ).toEqual(automation);
    expect(
      (await AutomationsService.update('org-1', 7, { name: 'New' })).name
    ).toBe('New');
    await AutomationsService.remove('org-1', 7);

    expect(calls()[0][0]).toBe(`${ORG}/automations/7`);
    expect(calls()[1][0]).toBe(`${ORG}/automations`);
    expect(calls()[1][1].method).toBe('POST');
    expect(JSON.parse(calls()[1][1].body)).toEqual({
      automation: { name: 'Spring offers' },
    });
    expect(calls()[2][1].method).toBe('PATCH');
    expect(JSON.parse(calls()[2][1].body)).toEqual({
      automation: { name: 'New' },
    });
    expect(calls()[3][0]).toBe(`${ORG}/automations/7`);
    expect(calls()[3][1].method).toBe('DELETE');
  });

  it('loads the registry and previews occurrences', async () => {
    const registry = {
      sources: [{ type: 'clock' }],
      actions: [{ type: 'interrupt' }],
    };
    (global.fetch as any)
      .mockResolvedValueOnce(okJson({ data: registry }))
      .mockResolvedValueOnce(
        okJson({
          data: { timezone: 'UTC', occurrences: ['2026-11-06T15:08:00Z'] },
        })
      );

    expect(await AutomationsService.registry('org-1')).toEqual(registry);
    const when = {
      source: 'clock',
      condition: 'at',
      config: { schedule: { type: 'hourly', minute: 8 } },
    };
    const preview = await AutomationsService.preview('org-1', {
      when,
      timezone: 'UTC',
      count: 10,
    });
    expect(preview.occurrences).toHaveLength(1);
    expect(calls()[0][0]).toBe(`${ORG}/automations/registry`);
    expect(calls()[1][0]).toBe(`${ORG}/automations/preview`);
    expect(JSON.parse(calls()[1][1].body)).toEqual({
      when,
      timezone: 'UTC',
      count: 10,
    });
  });

  it('sets assignments and runs rules', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okJson({ data: automation }))
      .mockResolvedValueOnce(okJson({ data: { devices: 3 } }));

    await AutomationsService.setAssignments('org-1', 7, {
      devices: ['d1'],
      channels: [3],
    });
    expect(await AutomationsService.runRule('org-1', 7, 'rule/1')).toEqual({
      devices: 3,
    });

    expect(calls()[0][0]).toBe(`${ORG}/automations/7/assignments`);
    expect(calls()[0][1].method).toBe('PUT');
    expect(JSON.parse(calls()[0][1].body)).toEqual({
      devices: ['d1'],
      channels: [3],
    });
    expect(calls()[1][0]).toBe(`${ORG}/automations/7/rules/rule%2F1/run`);
    expect(calls()[1][1].method).toBe('POST');
  });

  it('loads channel and device automations', async () => {
    const payload = {
      generated_at: 1,
      valid_until: 2,
      timezone: 'UTC',
      automations: [],
    };
    (global.fetch as any)
      .mockResolvedValueOnce(okJson({ data: [automation] }))
      .mockResolvedValueOnce(okJson({ data: [] }))
      .mockResolvedValueOnce(okJson({ data: payload }));

    await AutomationsService.channelAutomations('org-1', 3, {
      from: new Date('2026-11-02T00:00:00Z'),
      to: '2026-11-09T00:00:00Z',
    });
    await AutomationsService.channelAutomations('org-1', 3);
    expect(await AutomationsService.deviceAutomations('dev-1')).toEqual(
      payload
    );

    expect(calls()[0][0]).toBe(
      `${ORG}/channels/3/automations?from=2026-11-02T00%3A00%3A00.000Z&to=2026-11-09T00%3A00%3A00Z`
    );
    expect(calls()[1][0]).toBe(`${ORG}/channels/3/automations`);
    expect(calls()[2][0]).toBe(
      'https://api.example.com/dashboard/devices/dev-1/automations'
    );
  });

  it('searches assignable devices and channels', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okJson({ data: [], count: 0 }))
      .mockResolvedValueOnce(okJson({ data: [], count: 0 }));

    await AutomationsService.searchAssignable('org-1', 'devices', 'lobby');
    await AutomationsService.searchAssignable('org-1', 'channels');

    expect(calls()[0][0]).toBe(
      `${ORG}/devices?page=1&page_size=20&key=name&direction=ascending&search=lobby`
    );
    expect(calls()[1][0]).toBe(
      `${ORG}/channels?page=1&page_size=20&key=name&direction=ascending`
    );
  });

  it('throws server validation errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ errors: { rules: ['is invalid'] } }),
    });

    await expect(
      AutomationsService.create('org-1', { name: 'x' })
    ).rejects.toThrow('rules: is invalid');
  });

  it('normalizes occurrences to epoch ms', () => {
    expect(occurrenceToMs(1000)).toBe(1000);
    expect(occurrenceToMs('1970-01-01T00:00:01Z')).toBe(1000);
    expect(occurrenceToMs({ at: '1970-01-01T00:00:02Z' })).toBe(2000);
  });
});
