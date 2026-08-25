import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Period,
  SortDirection,
  SortField,
  VideoAnalyticsResponse,
} from '@shared/api';
import { api, ApiRequestError } from '@/lib/api';
import { useDebouncedValue } from './useDebouncedValue';

export interface AnalyticsQueryState {
  page: number;
  pageSize: number;
  sort: SortField;
  order: SortDirection;
  period: Period;
  search: string;
}

const INITIAL_QUERY: AnalyticsQueryState = {
  page: 1,
  pageSize: 10,
  sort: 'views',
  order: 'desc',
  period: '7d',
  search: '',
};

/** Text sorts A→Z by default; metrics sort highest-first. */
function defaultDirectionFor(field: SortField): SortDirection {
  return field === 'title' ? 'asc' : 'desc';
}

export interface UseVideoAnalytics {
  data: VideoAnalyticsResponse | null;
  error: ApiRequestError | null;
  /** True only on the very first load, when there is nothing to show yet. */
  isInitialLoading: boolean;
  /** True while any request is in flight, including background refreshes. */
  isFetching: boolean;
  query: AnalyticsQueryState;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
  setPeriod: (period: Period) => void;
  setSearch: (search: string) => void;
  toggleSort: (field: SortField) => void;
  refresh: () => void;
}

export function useVideoAnalytics(): UseVideoAnalytics {
  const [query, setQuery] = useState<AnalyticsQueryState>(INITIAL_QUERY);
  const [data, setData] = useState<VideoAnalyticsResponse | null>(null);
  const [error, setError] = useState<ApiRequestError | null>(null);
  const [isFetching, setIsFetching] = useState(true);

  // Bumping this re-runs the effect without changing the query, which is how
  // the traffic simulator forces a refresh.
  const [refreshToken, setRefreshToken] = useState(0);

  const debouncedSearch = useDebouncedValue(query.search, 300);

  // Tracks the newest request so a slow earlier response cannot overwrite a
  // faster later one. Aborting handles most of this; the guard covers the
  // window where a response has already been received but not yet applied.
  const requestId = useRef(0);

  const { page, pageSize, sort, order, period } = query;

  useEffect(() => {
    const controller = new AbortController();
    const id = ++requestId.current;

    setIsFetching(true);

    api
      .getVideoAnalytics(
        { page, pageSize, sort, order, period, search: debouncedSearch || undefined },
        controller.signal,
      )
      .then((response) => {
        if (id !== requestId.current) return;
        setData(response);
        setError(null);
      })
      .catch((cause: unknown) => {
        // An abort is this effect cleaning up after itself, not a failure.
        if (controller.signal.aborted) return;
        if (id !== requestId.current) return;
        setError(
          cause instanceof ApiRequestError
            ? cause
            : new ApiRequestError(0, 'UNKNOWN_ERROR', 'Something went wrong loading analytics.'),
        );
      })
      .finally(() => {
        if (id === requestId.current) setIsFetching(false);
      });

    return () => controller.abort();
  }, [page, pageSize, sort, order, period, debouncedSearch, refreshToken]);

  const setPage = useCallback((next: number) => {
    setQuery((current) => ({ ...current, page: Math.max(1, next) }));
  }, []);

  const setPageSize = useCallback((next: number) => {
    // Page 4 of 10-per-page is not page 4 of 50-per-page. Returning to the
    // first page is the only interpretation that is never surprising.
    setQuery((current) => ({ ...current, pageSize: next, page: 1 }));
  }, []);

  const setPeriod = useCallback((next: Period) => {
    setQuery((current) => ({ ...current, period: next, page: 1 }));
  }, []);

  const setSearch = useCallback((next: string) => {
    setQuery((current) => ({ ...current, search: next, page: 1 }));
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    setQuery((current) => {
      // Clicking the active column flips it; clicking a new one starts from
      // that column's natural direction rather than inheriting the old one.
      if (current.sort === field) {
        return { ...current, order: current.order === 'asc' ? 'desc' : 'asc', page: 1 };
      }
      return { ...current, sort: field, order: defaultDirectionFor(field), page: 1 };
    });
  }, []);

  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  return {
    data,
    error,
    isInitialLoading: isFetching && data === null,
    isFetching,
    query,
    setPage,
    setPageSize,
    setPeriod,
    setSearch,
    toggleSort,
    refresh,
  };
}
