/**
 * The HTTP contract between `server/` and `client/`.
 *
 * This file is the single source of truth for every payload that crosses the
 * network boundary. Both workspaces alias it (`@shared/*`), so changing a
 * response shape on the server surfaces as a type error in the client at
 * build time rather than as `undefined` in a table cell at runtime.
 */

/* ------------------------------------------------------------------ */
/* Domain primitives                                                    */
/* ------------------------------------------------------------------ */

/** The three interactions a shoppable video can produce, in funnel order. */
export const EVENT_TYPES = ['view', 'click', 'add_to_cart'] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/** Windows the dashboard can scope its aggregation to. */
export const PERIODS = ['24h', '7d', '30d', 'all'] as const;
export type Period = (typeof PERIODS)[number];

/** Columns the API is willing to order by. Anything else is rejected. */
export const SORT_FIELDS = [
  'title',
  'views',
  'clicks',
  'addToCarts',
  'clickThroughRate',
  'conversionRate',
  'lastEventAt',
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;
export type SortDirection = (typeof SORT_DIRECTIONS)[number];

/* ------------------------------------------------------------------ */
/* POST /api/events                                                     */
/* ------------------------------------------------------------------ */

export interface CreateEventRequest {
  videoId: number;
  eventType: EventType;
  /** ISO-8601 instant. Defaults to the moment the server received it. */
  occurredAt?: string;
}

export interface CreateEventResponse {
  data: {
    id: number;
    videoId: number;
    eventType: EventType;
    occurredAt: string;
  };
}

/* ------------------------------------------------------------------ */
/* GET /api/analytics/videos                                            */
/* ------------------------------------------------------------------ */

export interface VideoAnalyticsRow {
  videoId: number;
  title: string;
  videoUrl: string;
  product: {
    id: number;
    name: string;
    /** Minor units (cents). Formatted client-side — never stored as a float. */
    priceCents: number;
    currency: string;
  };
  /** Raw counts. The dashboard derives CTR and conversion rate from these. */
  views: number;
  clicks: number;
  addToCarts: number;
  /** ISO-8601 instant of the most recent event in the window, or null. */
  lastEventAt: string | null;
  /**
   * Daily view counts across the selected window, oldest first, zero-filled.
   * Powers the trend column without an N+1 request per row.
   */
  trend: number[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

/** Window-wide totals, independent of the current page. */
export interface AnalyticsTotals {
  videos: number;
  views: number;
  clicks: number;
  addToCarts: number;
}

export interface VideoAnalyticsResponse {
  data: VideoAnalyticsRow[];
  pagination: PaginationMeta;
  totals: AnalyticsTotals;
  meta: {
    period: Period;
    /** Inclusive lower bound of the window, or null when period is `all`. */
    since: string | null;
    sort: SortField;
    order: SortDirection;
    search: string | null;
  };
}

export interface VideoAnalyticsQuery {
  page?: number;
  pageSize?: number;
  sort?: SortField;
  order?: SortDirection;
  period?: Period;
  search?: string;
}

/* ------------------------------------------------------------------ */
/* GET /api/videos  (lookup list, used by the traffic simulator)        */
/* ------------------------------------------------------------------ */

export interface VideoSummary {
  id: number;
  title: string;
  productName: string;
}

export interface VideoListResponse {
  data: VideoSummary[];
}

/* ------------------------------------------------------------------ */
/* GET /api/health                                                      */
/* ------------------------------------------------------------------ */

export interface HealthResponse {
  status: 'ok';
  uptimeSeconds: number;
  database: 'connected';
  counts: { products: number; videos: number; events: number };
}

/* ------------------------------------------------------------------ */
/* Errors — every non-2xx response uses this shape                      */
/* ------------------------------------------------------------------ */

export interface ApiErrorBody {
  error: {
    /** Stable machine-readable code, e.g. `VALIDATION_ERROR`. */
    code: string;
    /** Human-readable sentence safe to surface in the UI. */
    message: string;
    /** Present on 422: per-field validation failures. */
    details?: Array<{ path: string; message: string }>;
  };
}
