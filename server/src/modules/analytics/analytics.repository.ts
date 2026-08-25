import type { Db } from '../../db/client.js';
import type {
  AnalyticsTotals,
  Period,
  SortDirection,
  SortField,
  VideoAnalyticsRow,
} from '../../../../shared/api.js';

/* --------------------------------------------------------------------- */
/* Window resolution                                                     */
/* --------------------------------------------------------------------- */

const PERIOD_HOURS: Record<Exclude<Period, 'all'>, number> = {
  '24h': 24,
  '7d': 24 * 7,
  '30d': 24 * 30,
};

/** Inclusive lower bound for a period, or `null` for the unbounded window. */
export function resolveSince(period: Period, now: Date = new Date()): string | null {
  if (period === 'all') return null;
  return new Date(now.getTime() - PERIOD_HOURS[period] * 3_600_000).toISOString();
}

/** How many daily buckets the trend column shows for a given period. */
export function trendBuckets(period: Period): number {
  return period === '24h' ? 24 : period === '30d' ? 30 : period === 'all' ? 14 : 7;
}

/* --------------------------------------------------------------------- */
/* Sorting                                                               */
/* --------------------------------------------------------------------- */

/**
 * ORDER BY cannot be parameterised — a bound value there is treated as a
 * constant, not an identifier. Mapping the client's sort key through this
 * frozen allow-list is what keeps the endpoint free of SQL injection while
 * still supporting user-chosen ordering.
 */
const SORT_EXPRESSIONS: Record<SortField, string> = {
  title: 'v.title COLLATE NOCASE',
  views: 'views',
  clicks: 'clicks',
  addToCarts: 'add_to_carts',
  clickThroughRate: 'CAST(clicks AS REAL) / NULLIF(views, 0)',
  // Conversion rate is *displayed* client-side (per the brief), but sorting it
  // must happen in SQL: ordering only the current page would produce a
  // different answer per page. NULLIF guards the zero-view case — dividing by
  // NULL yields NULL, which sorts last rather than erroring.
  conversionRate: 'CAST(add_to_carts AS REAL) / NULLIF(views, 0)',
  lastEventAt: 'last_event_at',
};

/* --------------------------------------------------------------------- */
/* Row shapes as they come back from SQLite                              */
/* --------------------------------------------------------------------- */

interface AggregateRow {
  video_id: number;
  title: string;
  video_url: string;
  product_id: number;
  product_name: string;
  price_cents: number;
  currency: string;
  views: number;
  clicks: number;
  add_to_carts: number;
  last_event_at: string | null;
}

interface TrendRow {
  video_id: number;
  bucket: string;
  views: number;
}

export interface VideoAnalyticsParams {
  page: number;
  pageSize: number;
  sort: SortField;
  order: SortDirection;
  period: Period;
  search: string | null;
  now?: Date;
}

export interface VideoAnalyticsResult {
  rows: VideoAnalyticsRow[];
  totalItems: number;
  totals: AnalyticsTotals;
  since: string | null;
}

/* --------------------------------------------------------------------- */
/* Queries                                                               */
/* --------------------------------------------------------------------- */

/**
 * Pre-aggregates the event log into one row per video *before* joining.
 *
 * The naive version of this query LEFT JOINs `engagement_events` directly and
 * groups afterwards. That works, but the join fans a 12-row video table out to
 * one row per event (tens of thousands) and only then collapses it — and once
 * a GROUP BY sits in the outer query, reasoning about what LIMIT applies to
 * gets subtle. Aggregating in a CTE keeps the outer query at exactly one row
 * per video, so LIMIT/OFFSET paginate *videos*, which is what the caller
 * asked for.
 *
 * `SUM(event_type = 'view')` is SQLite's idiom for conditional counting: the
 * comparison yields 1 or 0, so the sum is the count. It reads more cleanly
 * than three correlated subqueries and touches the index once.
 */
function buildAggregateSql(options: {
  hasWindow: boolean;
  hasSearch: boolean;
  orderBy: string;
  direction: SortDirection;
}): string {
  const eventWindow = options.hasWindow ? 'WHERE occurred_at >= @since' : '';
  const searchFilter = options.hasSearch
    ? 'WHERE (v.title LIKE @search ESCAPE \'\\\' OR p.name LIKE @search ESCAPE \'\\\')'
    : '';

  // SQLite sorts NULL below every other value, so an ascending sort would
  // float "no activity yet" rows to the top of the list. Explicit NULLS LAST
  // (SQLite 3.30+) keeps them at the bottom in both directions, which is what
  // a merchant scanning for signal actually wants.
  const nullHandling = ' NULLS LAST';

  return `
    WITH event_stats AS (
      SELECT
        video_id,
        SUM(event_type = 'view')        AS views,
        SUM(event_type = 'click')       AS clicks,
        SUM(event_type = 'add_to_cart') AS add_to_carts,
        MAX(occurred_at)                AS last_event_at
      FROM engagement_events
      ${eventWindow}
      GROUP BY video_id
    )
    SELECT
      v.id                        AS video_id,
      v.title                     AS title,
      v.video_url                 AS video_url,
      p.id                        AS product_id,
      p.name                      AS product_name,
      p.price_cents               AS price_cents,
      p.currency                  AS currency,
      COALESCE(s.views, 0)        AS views,
      COALESCE(s.clicks, 0)       AS clicks,
      COALESCE(s.add_to_carts, 0) AS add_to_carts,
      s.last_event_at             AS last_event_at
    FROM videos v
    INNER JOIN products p ON p.id = v.product_id
    -- LEFT JOIN, not INNER: a video with no events in the window is still a
    -- video the merchant published and needs to see.
    LEFT JOIN event_stats s ON s.video_id = v.id
    ${searchFilter}
    ORDER BY ${options.orderBy} ${options.direction.toUpperCase()}${nullHandling}, v.id ASC
    LIMIT @limit OFFSET @offset
  `;
}

/** Escapes the LIKE wildcards so a search for "100%" is a literal search. */
function toLikePattern(search: string): string {
  const escaped = search.replace(/[\\%_]/g, (match) => `\\${match}`);
  return `%${escaped}%`;
}

export function getVideoAnalytics(db: Db, params: VideoAnalyticsParams): VideoAnalyticsResult {
  const { page, pageSize, sort, order, period, search } = params;
  const since = resolveSince(period, params.now);
  const likePattern = search ? toLikePattern(search) : null;

  const bindings: Record<string, string | number> = {
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
  if (since) bindings.since = since;
  if (likePattern) bindings.search = likePattern;

  const sql = buildAggregateSql({
    hasWindow: since !== null,
    hasSearch: likePattern !== null,
    orderBy: SORT_EXPRESSIONS[sort],
    direction: order,
  });

  const aggregates = db.prepare(sql).all(bindings) as AggregateRow[];

  /* -- Total row count, for pagination metadata ------------------------ */
  const countSql = likePattern
    ? `SELECT COUNT(*) AS total FROM videos v
       INNER JOIN products p ON p.id = v.product_id
       WHERE (v.title LIKE @search ESCAPE '\\' OR p.name LIKE @search ESCAPE '\\')`
    : `SELECT COUNT(*) AS total FROM videos`;
  const { total } = db.prepare(countSql).get(likePattern ? { search: likePattern } : {}) as {
    total: number;
  };

  /* -- Window-wide totals, independent of the current page ------------- */
  const totals = getTotals(db, { since, search: likePattern });

  /* -- Daily trend for the videos on this page only -------------------- */
  const trends = getTrends(
    db,
    aggregates.map((row) => row.video_id),
    { period, since, now: params.now ?? new Date() },
  );

  const rows: VideoAnalyticsRow[] = aggregates.map((row) => ({
    videoId: row.video_id,
    title: row.title,
    videoUrl: row.video_url,
    product: {
      id: row.product_id,
      name: row.product_name,
      priceCents: row.price_cents,
      currency: row.currency,
    },
    views: row.views,
    clicks: row.clicks,
    addToCarts: row.add_to_carts,
    lastEventAt: row.last_event_at,
    trend: trends.get(row.video_id) ?? new Array<number>(trendBuckets(period)).fill(0),
  }));

  return { rows, totalItems: total, totals, since };
}

/**
 * Aggregate counters for the funnel strip.
 *
 * Deliberately *not* derived by summing the page's rows: the strip describes
 * the whole window, and paging from 1 to 2 must not change it.
 */
function getTotals(
  db: Db,
  scope: { since: string | null; search: string | null },
): AnalyticsTotals {
  const conditions: string[] = [];
  const bindings: Record<string, string> = {};

  if (scope.since) {
    conditions.push('e.occurred_at >= @since');
    bindings.since = scope.since;
  }
  if (scope.search) {
    conditions.push("(v.title LIKE @search ESCAPE '\\' OR p.name LIKE @search ESCAPE '\\')");
    bindings.search = scope.search;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const eventTotals = db
    .prepare(
      `SELECT
         COALESCE(SUM(e.event_type = 'view'), 0)        AS views,
         COALESCE(SUM(e.event_type = 'click'), 0)       AS clicks,
         COALESCE(SUM(e.event_type = 'add_to_cart'), 0) AS add_to_carts
       FROM engagement_events e
       INNER JOIN videos v   ON v.id = e.video_id
       INNER JOIN products p ON p.id = v.product_id
       ${where}`,
    )
    .get(bindings) as { views: number; clicks: number; add_to_carts: number };

  const videoScope = scope.search
    ? `SELECT COUNT(*) AS videos FROM videos v
       INNER JOIN products p ON p.id = v.product_id
       WHERE (v.title LIKE @search ESCAPE '\\' OR p.name LIKE @search ESCAPE '\\')`
    : `SELECT COUNT(*) AS videos FROM videos`;

  const { videos } = db
    .prepare(videoScope)
    .get(scope.search ? { search: scope.search } : {}) as { videos: number };

  return {
    videos,
    views: eventTotals.views,
    clicks: eventTotals.clicks,
    addToCarts: eventTotals.add_to_carts,
  };
}

/**
 * Daily (or hourly, for `24h`) view counts for the videos on the current page.
 *
 * One query for the whole page rather than one per row: fetching a trend
 * per video would be a textbook N+1, and at 100 rows per page that is 100
 * round trips to render a single column.
 */
function getTrends(
  db: Db,
  videoIds: number[],
  scope: { period: Period; since: string | null; now: Date },
): Map<number, number[]> {
  const result = new Map<number, number[]>();
  if (videoIds.length === 0) return result;

  const buckets = trendBuckets(scope.period);
  const hourly = scope.period === '24h';
  const bucketMs = hourly ? 3_600_000 : 86_400_000;

  // For `all`, the trend still shows a bounded recent window — an unbounded
  // sparkline would compress years of history into 14 unreadable pixels.
  const windowStart = new Date(scope.now.getTime() - (buckets - 1) * bucketMs);
  const alignedStart = hourly
    ? new Date(Math.floor(windowStart.getTime() / bucketMs) * bucketMs)
    : new Date(`${windowStart.toISOString().slice(0, 10)}T00:00:00.000Z`);

  // SQLite has no array binding, so the id list is expanded into placeholders.
  // The values are still bound, never interpolated — they are integers that
  // came from our own previous query, but the discipline is what matters.
  const placeholders = videoIds.map(() => '?').join(', ');
  const bucketExpression = hourly
    ? "strftime('%Y-%m-%dT%H', occurred_at)"
    : "substr(occurred_at, 1, 10)";

  const rows = db
    .prepare(
      `SELECT video_id, ${bucketExpression} AS bucket, SUM(event_type = 'view') AS views
       FROM engagement_events
       WHERE video_id IN (${placeholders})
         AND occurred_at >= ?
       GROUP BY video_id, bucket`,
    )
    .all(...videoIds, alignedStart.toISOString()) as TrendRow[];

  // Build the zero-filled skeleton first, then drop the counts in. A sparkline
  // with gaps collapsed out would misrepresent a quiet day as "no day".
  const bucketKeys: string[] = [];
  for (let i = 0; i < buckets; i += 1) {
    const at = new Date(alignedStart.getTime() + i * bucketMs);
    bucketKeys.push(hourly ? at.toISOString().slice(0, 13) : at.toISOString().slice(0, 10));
  }

  for (const id of videoIds) {
    result.set(id, new Array<number>(buckets).fill(0));
  }

  for (const row of rows) {
    const series = result.get(row.video_id);
    if (!series) continue;
    const index = bucketKeys.indexOf(row.bucket);
    if (index >= 0) series[index] = row.views;
  }

  return result;
}

/** Lightweight video list used by the traffic simulator's target picker. */
export function listVideos(db: Db): Array<{ id: number; title: string; productName: string }> {
  const rows = db
    .prepare(
      `SELECT v.id AS id, v.title AS title, p.name AS product_name
       FROM videos v
       INNER JOIN products p ON p.id = v.product_id
       ORDER BY v.id ASC`,
    )
    .all() as Array<{ id: number; title: string; product_name: string }>;

  return rows.map((row) => ({ id: row.id, title: row.title, productName: row.product_name }));
}
