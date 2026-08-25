import type {
  ApiErrorBody,
  CreateEventRequest,
  CreateEventResponse,
  HealthResponse,
  VideoAnalyticsQuery,
  VideoAnalyticsResponse,
  VideoListResponse,
} from '@shared/api';

/**
 * Relative by default: the Vite dev server proxies `/api` to Express, so the
 * browser only ever talks to one origin and CORS never enters the local path.
 */
const BASE_URL = import.meta.env.VITE_API_URL ?? '';

/**
 * An API failure the UI can render.
 *
 * The point of carrying `code` alongside the message is that the interface can
 * branch on the machine value — a 429 gets "slow down", a network drop gets
 * "check the server is running" — while still having a sentence to display.
 */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }

  /** True when the API was never reached at all. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    // fetch only rejects when the request never completed — DNS failure,
    // connection refused, or an aborted request. An HTTP 500 resolves.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiRequestError(
      0,
      'NETWORK_ERROR',
      'Could not reach the API. Check that the server is running on port 4400.',
    );
  }

  if (!response.ok) {
    // A non-2xx from a proxy or a crashed process may not be JSON at all, so
    // parsing is allowed to fail without masking the original status.
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    throw new ApiRequestError(
      response.status,
      body?.error.code ?? 'UNKNOWN_ERROR',
      body?.error.message ?? `Request failed with status ${response.status}.`,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Serializes only the params that are set, so the URL stays readable. */
function toQueryString(query: VideoAnalyticsQuery): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const serialized = params.toString();
  return serialized ? `?${serialized}` : '';
}

export const api = {
  getVideoAnalytics(query: VideoAnalyticsQuery, signal?: AbortSignal) {
    return request<VideoAnalyticsResponse>(`/api/analytics/videos${toQueryString(query)}`, {
      signal,
    });
  },

  listVideos(signal?: AbortSignal) {
    return request<VideoListResponse>('/api/videos', { signal });
  },

  createEvent(payload: CreateEventRequest) {
    return request<CreateEventResponse>('/api/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  getHealth(signal?: AbortSignal) {
    return request<HealthResponse>('/api/health', { signal });
  },
};
