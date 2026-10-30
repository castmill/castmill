import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  AgentsService,
  getMcpServerUrl,
  parseServerDate,
} from './agents.service';

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

const agent = {
  id: 'agent-1',
  name: 'Bot',
  role: 'member',
  has_credentials: true,
};

describe('AgentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the MCP server URL', () => {
    expect(getMcpServerUrl()).toBe('https://api.example.com/mcp');
  });

  it('lists agents', async () => {
    (global.fetch as any).mockResolvedValueOnce(okJson({ data: [agent] }));

    const result = await AgentsService.list('org-1');

    expect(result).toEqual([agent]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.example.com/dashboard/organizations/org-1/agents',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('creates an agent and returns the secret', async () => {
    (global.fetch as any).mockResolvedValueOnce(
      okJson({ data: agent, secret: 'cmagt_secret' }, 201)
    );

    const result = await AgentsService.create('org-1', {
      name: 'Bot',
      role: 'editor',
    });

    expect(result.secret).toBe('cmagt_secret');
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe(
      'https://api.example.com/dashboard/organizations/org-1/agents'
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({
      agent: { name: 'Bot', role: 'editor' },
    });
  });

  it('updates, rotates, revokes and deletes agents', async () => {
    (global.fetch as any)
      .mockResolvedValueOnce(okJson({ data: { ...agent, name: 'New' } }))
      .mockResolvedValueOnce(okJson({ data: agent, secret: 'cmagt_new' }))
      .mockResolvedValueOnce(
        okJson({ data: { ...agent, has_credentials: false } })
      )
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });

    expect(
      (await AgentsService.update('org-1', 'agent-1', { name: 'New' })).name
    ).toBe('New');
    expect(
      (await AgentsService.rotateCredentials('org-1', 'agent-1')).secret
    ).toBe('cmagt_new');
    expect(
      (await AgentsService.revokeCredentials('org-1', 'agent-1'))
        .has_credentials
    ).toBe(false);
    await AgentsService.remove('org-1', 'agent-1');

    const calls = (global.fetch as any).mock.calls;
    expect(calls[0][1].method).toBe('PATCH');
    expect(calls[1][0]).toBe(
      'https://api.example.com/dashboard/organizations/org-1/agents/agent-1/credentials'
    );
    expect(calls[1][1].method).toBe('POST');
    expect(calls[2][1].method).toBe('DELETE');
    expect(calls[3][0]).toBe(
      'https://api.example.com/dashboard/organizations/org-1/agents/agent-1'
    );
    expect(calls[3][1].method).toBe('DELETE');
  });

  it('lists actions with filters', async () => {
    (global.fetch as any).mockResolvedValueOnce(okJson({ data: [], count: 0 }));

    await AgentsService.listActions('org-1', {
      agentId: 'agent-1',
      status: 'error',
      page: 2,
      pageSize: 10,
    });

    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toBe(
      'https://api.example.com/dashboard/organizations/org-1/agent-actions?agent_id=agent-1&status=error&page=2&page_size=10'
    );
  });

  it('throws server errors', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ errors: { name: ["can't be blank"] } }),
    });

    await expect(AgentsService.create('org-1', {})).rejects.toThrow(
      "name: can't be blank"
    );
  });

  it('parses naive server timestamps as UTC', () => {
    expect(parseServerDate('2026-01-01T10:00:00').toISOString()).toBe(
      '2026-01-01T10:00:00.000Z'
    );
    expect(parseServerDate('2026-01-01T10:00:00Z').toISOString()).toBe(
      '2026-01-01T10:00:00.000Z'
    );
    expect(parseServerDate('2026-01-01T12:00:00+02:00').toISOString()).toBe(
      '2026-01-01T10:00:00.000Z'
    );
  });
});
