import { baseUrl } from '../env';
import { authFetch } from '../components/auth';
import { handleResponse } from './util';
import { OrganizationRole } from '../types/organization-role.type';

export interface Agent {
  id: string;
  name: string;
  description?: string | null;
  role: OrganizationRole;
  user_id: string;
  organization_id: string;
  has_credentials: boolean;
  secret_prefix?: string | null;
  credential_rotated_at?: string | null;
  last_used_at?: string | null;
  last_ip?: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface AgentAction {
  id: number;
  agent_id: string;
  agent_name: string;
  tool: string;
  arguments?: Record<string, unknown> | null;
  method?: string | null;
  path?: string | null;
  status: 'success' | 'error';
  http_status?: number | null;
  error?: string | null;
  duration_ms?: number | null;
  ip?: string | null;
  inserted_at: string;
}

export interface AgentAttrs {
  name?: string;
  description?: string;
  role?: OrganizationRole;
}

export interface AgentWithSecret {
  data: Agent;
  secret: string;
}

export interface ListAgentActionsParams {
  agentId?: string;
  status?: 'success' | 'error';
  page?: number;
  pageSize?: number;
}

const agentsUrl = (organizationId: string) =>
  `${baseUrl}/dashboard/organizations/${organizationId}/agents`;

const jsonOptions = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

/**
 * Parses timestamps returned by the server. Naive timestamps are UTC.
 */
export const parseServerDate = (value: string) =>
  new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(value) ? value : `${value}Z`);

/**
 * URL of the MCP server that agents connect to.
 */
export const getMcpServerUrl = () => `${baseUrl}/mcp`;

export const AgentsService = {
  async list(organizationId: string): Promise<Agent[]> {
    const response = await authFetch(agentsUrl(organizationId), {
      method: 'GET',
    });
    const result = await handleResponse<{ data: Agent[] }>(response, {
      parse: true,
    });
    return result.data;
  },

  async create(
    organizationId: string,
    attrs: AgentAttrs
  ): Promise<AgentWithSecret> {
    const response = await authFetch(
      agentsUrl(organizationId),
      jsonOptions('POST', { agent: attrs })
    );
    return handleResponse<AgentWithSecret>(response, { parse: true });
  },

  async update(
    organizationId: string,
    agentId: string,
    attrs: AgentAttrs
  ): Promise<Agent> {
    const response = await authFetch(
      `${agentsUrl(organizationId)}/${agentId}`,
      jsonOptions('PATCH', { agent: attrs })
    );
    const result = await handleResponse<{ data: Agent }>(response, {
      parse: true,
    });
    return result.data;
  },

  async remove(organizationId: string, agentId: string): Promise<void> {
    const response = await authFetch(
      `${agentsUrl(organizationId)}/${agentId}`,
      { method: 'DELETE' }
    );
    await handleResponse(response);
  },

  async rotateCredentials(
    organizationId: string,
    agentId: string
  ): Promise<AgentWithSecret> {
    const response = await authFetch(
      `${agentsUrl(organizationId)}/${agentId}/credentials`,
      { method: 'POST' }
    );
    return handleResponse<AgentWithSecret>(response, { parse: true });
  },

  async revokeCredentials(
    organizationId: string,
    agentId: string
  ): Promise<Agent> {
    const response = await authFetch(
      `${agentsUrl(organizationId)}/${agentId}/credentials`,
      { method: 'DELETE' }
    );
    const result = await handleResponse<{ data: Agent }>(response, {
      parse: true,
    });
    return result.data;
  },

  async listActions(
    organizationId: string,
    params: ListAgentActionsParams = {}
  ): Promise<{ data: AgentAction[]; count: number }> {
    const query = new URLSearchParams();
    if (params.agentId) query.set('agent_id', params.agentId);
    if (params.status) query.set('status', params.status);
    query.set('page', String(params.page ?? 1));
    query.set('page_size', String(params.pageSize ?? 25));

    const response = await authFetch(
      `${baseUrl}/dashboard/organizations/${organizationId}/agent-actions?${query.toString()}`,
      { method: 'GET' }
    );
    return handleResponse<{ data: AgentAction[]; count: number }>(response, {
      parse: true,
    });
  },
};
