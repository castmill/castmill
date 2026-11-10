import { baseUrl } from '../env';
import { authFetch } from '../components/auth';
import { handleResponse } from './util';

/**
 * Typed client for the Automations dashboard API.
 * See agents/systems/AUTOMATIONS.md for the contract.
 */

/** ISO weekday, 1 = Monday … 7 = Sunday. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ClockSchedule =
  | { type: 'hourly'; minute: number }
  | { type: 'interval'; every_minutes: number }
  | { type: 'times'; times: string[] }
  | { type: 'once'; date: string; time: string };

export type ClockScheduleType = ClockSchedule['type'];

export interface ClockWindow {
  start: string;
  end: string;
}

export interface ClockDates {
  start: string | null;
  end: string | null;
}

export interface ClockConfig {
  schedule: ClockSchedule;
  weekdays?: IsoWeekday[] | null;
  window?: ClockWindow | null;
  dates?: ClockDates | null;
  timezone?: string | null;
}

export type InterruptStart = 'immediately' | 'after_current_item';
export type InterruptPriority = 'normal' | 'high';

export interface InterruptConfig {
  playlist_id: number | null;
  start: InterruptStart;
  max_wait_seconds?: number;
  plays: number;
  priority: InterruptPriority;
}

export interface RuleWhen<C = Record<string, unknown>> {
  source: string;
  condition: string;
  config: C;
}

export interface RuleThen<C = Record<string, unknown>> {
  action: string;
  config: C;
}

export interface AutomationRule {
  id?: string;
  when: RuleWhen<any>;
  then: RuleThen<any>;
  cooldown_seconds: number;
}

export interface AutomationDeviceRef {
  id: string;
  name: string;
  online?: boolean;
  timezone?: string | null;
}

export interface AutomationChannelRef {
  id: number;
  name: string;
  timezone?: string | null;
}

export interface AutomationWarning {
  rule_id: string;
  device_id: string;
  device_name: string;
  missing: string;
}

export interface Automation {
  id: number;
  name: string;
  enabled: boolean;
  organization_id: string;
  rules: AutomationRule[];
  inserted_at: string;
  updated_at: string;
  devices: AutomationDeviceRef[];
  channels: AutomationChannelRef[];
  next_firing: string | null;
  warnings: AutomationWarning[];
}

export interface ChannelAutomationOccurrence {
  rule_id: string;
  /** ISO 8601 (UTC). */
  at: string;
}

/** Automation as returned by the channel automations endpoint. */
export interface ChannelAutomation {
  id: number;
  name: string;
  enabled: boolean;
  rules: AutomationRule[];
  /** Firings in the requested range, sorted. */
  occurrences: ChannelAutomationOccurrence[];
}

export interface AutomationAttrs {
  name?: string;
  enabled?: boolean;
  rules?: AutomationRule[];
}

export interface RegistryCondition {
  name: string;
  kind: 'event' | 'state';
}

export interface RegistrySource {
  type: string;
  conditions?: RegistryCondition[];
  required_capability?: string;
}

export interface RegistryAction {
  type: string;
  supports?: Array<'event' | 'state'>;
  required_capability?: string;
}

export interface AutomationsRegistry {
  sources: RegistrySource[];
  actions: RegistryAction[];
}

export interface PreviewRequest {
  when: RuleWhen<any>;
  timezone?: string;
  count?: number;
}

export interface PreviewResult {
  timezone: string;
  occurrences: string[];
}

export interface AutomationAssignments {
  devices: string[];
  channels: number[];
}

export interface ListAutomationsParams {
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DeviceAutomationVia {
  type: 'device' | 'channel';
  id?: number;
  name?: string;
}

export interface DeviceAutomationRule {
  id: string;
  index: number;
  source: string;
  condition: string;
  kind: 'event' | 'state';
  source_payload: { occurrences?: number[] } & Record<string, unknown>;
  action: string;
  action_config: Record<string, unknown>;
  cooldown_seconds: number;
  resources?: Record<string, unknown[]>;
}

export interface DeviceAutomation {
  id: number;
  name: string;
  via: DeviceAutomationVia[];
  rules: DeviceAutomationRule[];
}

export interface DeviceAutomationsPayload {
  generated_at: number;
  valid_until: number;
  timezone: string;
  automations: DeviceAutomation[];
}

/** A device or channel that can be assigned to an automation. */
export interface AssignableResource {
  id: string | number;
  name: string;
}

const automationsUrl = (organizationId: string) =>
  `${baseUrl}/dashboard/organizations/${organizationId}/automations`;

const jsonOptions = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const getJson = async <T>(url: string): Promise<T> => {
  const response = await authFetch(url, { method: 'GET' });
  return handleResponse<T>(response, { parse: true });
};

const toIso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : value;

/** Normalizes an occurrence (ISO 8601, epoch ms or `{at}`) to epoch ms. */
export const occurrenceToMs = (
  value: string | number | { at: string | number }
): number => {
  const raw = typeof value === 'object' && value ? value.at : value;
  return typeof raw === 'number' ? raw : new Date(raw).getTime();
};

export const AutomationsService = {
  async list(
    organizationId: string,
    params: ListAutomationsParams = {}
  ): Promise<{ data: Automation[]; count: number }> {
    const query = new URLSearchParams();
    if (params.search) query.set('search', params.search);
    query.set('page', String(params.page ?? 1));
    query.set('page_size', String(params.pageSize ?? 10));
    return getJson(`${automationsUrl(organizationId)}?${query.toString()}`);
  },

  async get(organizationId: string, id: number): Promise<Automation> {
    const result = await getJson<{ data: Automation }>(
      `${automationsUrl(organizationId)}/${id}`
    );
    return result.data;
  },

  async create(
    organizationId: string,
    attrs: AutomationAttrs
  ): Promise<Automation> {
    const response = await authFetch(
      automationsUrl(organizationId),
      jsonOptions('POST', { automation: attrs })
    );
    const result = await handleResponse<{ data: Automation }>(response, {
      parse: true,
    });
    return result.data;
  },

  async update(
    organizationId: string,
    id: number,
    attrs: AutomationAttrs
  ): Promise<Automation> {
    const response = await authFetch(
      `${automationsUrl(organizationId)}/${id}`,
      jsonOptions('PATCH', { automation: attrs })
    );
    const result = await handleResponse<{ data: Automation }>(response, {
      parse: true,
    });
    return result.data;
  },

  async remove(organizationId: string, id: number): Promise<void> {
    const response = await authFetch(
      `${automationsUrl(organizationId)}/${id}`,
      { method: 'DELETE' }
    );
    await handleResponse(response);
  },

  async registry(organizationId: string): Promise<AutomationsRegistry> {
    const result = await getJson<{ data: AutomationsRegistry }>(
      `${automationsUrl(organizationId)}/registry`
    );
    return result.data;
  },

  async preview(
    organizationId: string,
    request: PreviewRequest
  ): Promise<PreviewResult> {
    const response = await authFetch(
      `${automationsUrl(organizationId)}/preview`,
      jsonOptions('POST', request)
    );
    const result = await handleResponse<{ data: PreviewResult }>(response, {
      parse: true,
    });
    return result.data;
  },

  async setAssignments(
    organizationId: string,
    id: number,
    assignments: AutomationAssignments
  ): Promise<Automation> {
    const response = await authFetch(
      `${automationsUrl(organizationId)}/${id}/assignments`,
      jsonOptions('PUT', assignments)
    );
    const result = await handleResponse<{ data: Automation }>(response, {
      parse: true,
    });
    return result.data;
  },

  async runRule(
    organizationId: string,
    id: number,
    ruleId: string
  ): Promise<{ devices: number }> {
    const response = await authFetch(
      `${automationsUrl(organizationId)}/${id}/rules/${encodeURIComponent(ruleId)}/run`,
      { method: 'POST' }
    );
    const result = await handleResponse<{ data: { devices: number } }>(
      response,
      { parse: true }
    );
    return result.data;
  },

  async channelAutomations(
    organizationId: string,
    channelId: number,
    range: { from?: Date | string; to?: Date | string } = {}
  ): Promise<ChannelAutomation[]> {
    const query = new URLSearchParams();
    if (range.from) query.set('from', toIso(range.from));
    if (range.to) query.set('to', toIso(range.to));
    const qs = query.toString();
    const result = await getJson<{ data: ChannelAutomation[] }>(
      `${baseUrl}/dashboard/organizations/${organizationId}/channels/${channelId}/automations${qs ? `?${qs}` : ''}`
    );
    return result.data;
  },

  async deviceAutomations(deviceId: string): Promise<DeviceAutomationsPayload> {
    const result = await getJson<{ data: DeviceAutomationsPayload }>(
      `${baseUrl}/dashboard/devices/${deviceId}/automations`
    );
    return result.data;
  },

  /** Searches devices or channels of the organization for the assignments UI. */
  async searchAssignable(
    organizationId: string,
    resource: 'devices' | 'channels',
    search = '',
    pageSize = 20
  ): Promise<{ data: AssignableResource[]; count: number }> {
    const query = new URLSearchParams({
      page: '1',
      page_size: String(pageSize),
      key: 'name',
      direction: 'ascending',
    });
    if (search) query.set('search', search);
    return getJson(
      `${baseUrl}/dashboard/organizations/${organizationId}/${resource}?${query.toString()}`
    );
  },
};
