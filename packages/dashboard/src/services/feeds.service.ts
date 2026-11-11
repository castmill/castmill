import { baseUrl } from '../env';
import { authFetch } from '../components/auth';

export type FeedMode = 'list' | 'document';

export interface FeedMediaField {
  path: string;
  mode?: 'copy' | 'link';
}

export interface Feed {
  id: string;
  organization_id: string;
  name: string;
  description?: string | null;
  mode: FeedMode;
  keep: number;
  schema?: Record<string, unknown> | null;
  media_fields: FeedMediaField[];
  version: number;
  data_updated_at?: string | null;
  inserted_at: string;
  updated_at: string;
  /** Null for document feeds. */
  entry_count: number | null;
  usage_count?: number;
}

export interface FeedDetails extends Feed {
  used_by: { id: number; name: string; items: number }[];
  endpoints: { append: string; replace: string; read: string };
  /** Bytes of copied media. */
  media_storage?: number;
}

export type FeedMediaStatus = 'pending' | 'ready' | 'failed';

/** A copy of an image or video referenced by a feed's entries. */
export interface FeedMedia {
  id: string;
  status: FeedMediaStatus;
  failure_reason?: string | null;
  /** The stored copy, once ready. */
  url?: string | null;
  /** Only the original URL's host is exposed. */
  original_host: string | null;
  content_type?: string | null;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  duration?: number | null;
  entries: number;
  inserted_at: string;
  updated_at: string;
}

export interface FeedEntry {
  id: string;
  received_at: string;
  external_id?: string;
  [field: string]: unknown;
}

export interface FeedData {
  entries?: FeedEntry[];
  document?: Record<string, unknown> | null;
  updated_at: string | null;
}

export interface FeedToken {
  id: string;
  feed_id: string;
  name: string;
  hint: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
  inserted_at: string;
}

export interface FeedAttrs {
  name?: string;
  description?: string | null;
  mode?: FeedMode;
  keep?: number;
  schema?: Record<string, unknown> | null;
  media_fields?: FeedMediaField[];
}

/** Error returned by the feeds API, with the server's message when available. */
export class FeedsError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'FeedsError';
  }
}

const feedsUrl = (organizationId: string, suffix = '') =>
  `${baseUrl}/dashboard/organizations/${organizationId}/feeds${suffix}`;

const jsonOptions = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
});

const request = async <T>(url: string, init: RequestInit): Promise<T> => {
  const response = await authFetch(url, init);
  if (response.ok) {
    return response.status === 204 ? (undefined as T) : response.json();
  }
  const body = await response.json().catch(() => null);
  const errors = body?.errors as Record<string, string[]> | undefined;
  const message =
    (typeof body?.error === 'string' && body?.message) ||
    (typeof body?.error === 'string' && body.error) ||
    (errors &&
      Object.entries(errors)
        .map(([field, messages]) => `${field} ${messages.join(', ')}`)
        .join('; ')) ||
    response.statusText;
  throw new FeedsError(message, response.status, body?.error);
};

export const FeedsService = {
  list(
    organizationId: string,
    params: { page?: number; pageSize?: number; search?: string } = {}
  ): Promise<{ data: Feed[]; count: number }> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.pageSize) query.set('page_size', String(params.pageSize));
    if (params.search) query.set('search', params.search);
    const suffix = query.toString() ? `?${query}` : '';
    return request(feedsUrl(organizationId, suffix), { method: 'GET' });
  },

  async get(organizationId: string, feedId: string): Promise<FeedDetails> {
    const result = await request<{ data: FeedDetails }>(
      feedsUrl(organizationId, `/${feedId}`),
      { method: 'GET' }
    );
    return result.data;
  },

  async create(organizationId: string, attrs: FeedAttrs): Promise<FeedDetails> {
    const result = await request<{ data: FeedDetails }>(
      feedsUrl(organizationId),
      jsonOptions('POST', { feed: attrs })
    );
    return result.data;
  },

  async update(
    organizationId: string,
    feedId: string,
    attrs: FeedAttrs
  ): Promise<FeedDetails> {
    const result = await request<{ data: FeedDetails }>(
      feedsUrl(organizationId, `/${feedId}`),
      jsonOptions('PATCH', { feed: attrs })
    );
    return result.data;
  },

  remove(organizationId: string, feedId: string): Promise<void> {
    return request(feedsUrl(organizationId, `/${feedId}`), {
      method: 'DELETE',
    });
  },

  async data(
    organizationId: string,
    feedId: string
  ): Promise<{ data: FeedData; version: number }> {
    return request(feedsUrl(organizationId, `/${feedId}/entries`), {
      method: 'GET',
    });
  },

  /** Sends a test entry (list feeds) or replaces the document (document feeds). */
  sendTest(
    organizationId: string,
    feedId: string,
    mode: FeedMode,
    value: Record<string, unknown>
  ): Promise<{ data: FeedData; version: number }> {
    return request(
      feedsUrl(organizationId, `/${feedId}/test-entry`),
      jsonOptions(
        'POST',
        mode === 'list' ? { entry: value } : { document: value }
      )
    );
  },

  deleteEntry(
    organizationId: string,
    feedId: string,
    entryId: string
  ): Promise<void> {
    return request(feedsUrl(organizationId, `/${feedId}/entries/${entryId}`), {
      method: 'DELETE',
    });
  },

  clear(organizationId: string, feedId: string): Promise<void> {
    return request(feedsUrl(organizationId, `/${feedId}/entries`), {
      method: 'DELETE',
    });
  },

  /** The feed's copied media and the bytes they use. */
  media(
    organizationId: string,
    feedId: string
  ): Promise<{ data: FeedMedia[]; storage: number }> {
    return request(feedsUrl(organizationId, `/${feedId}/media`), {
      method: 'GET',
    });
  },

  /** Queues a failed media for another download. */
  async retryMedia(
    organizationId: string,
    feedId: string,
    mediaId: string
  ): Promise<{ id: string; status: FeedMediaStatus }> {
    const result = await request<{
      data: { id: string; status: FeedMediaStatus };
    }>(feedsUrl(organizationId, `/${feedId}/media/${mediaId}/retry`), {
      method: 'POST',
    });
    return result.data;
  },

  async tokens(organizationId: string, feedId: string): Promise<FeedToken[]> {
    const result = await request<{ data: FeedToken[] }>(
      feedsUrl(organizationId, `/${feedId}/tokens`),
      { method: 'GET' }
    );
    return result.data;
  },

  /** Creates a token; the returned secret can't be retrieved again. */
  async createToken(
    organizationId: string,
    feedId: string,
    name: string
  ): Promise<{ token: FeedToken; secret: string }> {
    const result = await request<{ data: FeedToken; secret: string }>(
      feedsUrl(organizationId, `/${feedId}/tokens`),
      jsonOptions('POST', { name })
    );
    return { token: result.data, secret: result.secret };
  },

  async revokeToken(
    organizationId: string,
    feedId: string,
    tokenId: string
  ): Promise<FeedToken> {
    const result = await request<{ data: FeedToken }>(
      feedsUrl(organizationId, `/${feedId}/tokens/${tokenId}`),
      { method: 'DELETE' }
    );
    return result.data;
  },
};
