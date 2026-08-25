import type { Db } from '../../db/client.js';
import type { VideoAnalyticsResponse } from '../../../../shared/api.js';
import { getVideoAnalytics } from './analytics.repository.js';
import type { VideoAnalyticsQueryInput } from './analytics.validation.js';

/**
 * Turns a validated query into the response envelope.
 *
 * The service owns pagination arithmetic and clamping; the repository owns
 * SQL. Keeping the boundary there means the "what does page 9 of 4 mean"
 * question is answered in one place and is trivially unit-testable.
 */
export function buildVideoAnalytics(
  db: Db,
  query: VideoAnalyticsQueryInput,
): VideoAnalyticsResponse {
  const { pageSize, sort, order, period, search } = query;

  // First pass establishes how many rows the filter actually matches.
  const probe = getVideoAnalytics(db, {
    page: query.page,
    pageSize,
    sort,
    order,
    period,
    search,
  });

  const totalPages = Math.max(1, Math.ceil(probe.totalItems / pageSize));

  // Asking for page 9 of a 4-page result should return the last page of data,
  // not an empty array. An empty page reads as "no results" to a user who has
  // simply paged past the end after a filter narrowed the set.
  const page = Math.min(Math.max(1, query.page), totalPages);

  const result =
    page === query.page
      ? probe
      : getVideoAnalytics(db, { page, pageSize, sort, order, period, search });

  return {
    data: result.rows,
    pagination: {
      page,
      pageSize,
      totalItems: result.totalItems,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
    totals: result.totals,
    meta: {
      period,
      since: result.since,
      sort,
      order,
      search,
    },
  };
}
