import { useCallback } from 'react';
import type { Period } from '@shared/api';
import { AppBar } from '@/components/AppBar';
import { SegmentedControl, type SegmentOption } from '@/components/SegmentedControl';
import { Toaster } from '@/components/Toaster';
import { AnalyticsTable } from '@/features/analytics/AnalyticsTable';
import { FunnelStrip } from '@/features/analytics/FunnelStrip';
import { Pagination } from '@/features/analytics/Pagination';
import { useTrafficSimulator } from '@/features/analytics/useTrafficSimulator';
import { useTheme } from '@/hooks/useTheme';
import { useVideoAnalytics } from '@/hooks/useVideoAnalytics';
import styles from './App.module.scss';

const PERIOD_OPTIONS: ReadonlyArray<SegmentOption<Period>> = [
  { value: '24h', label: '24h', description: 'Last 24 hours' },
  { value: '7d', label: '7d', description: 'Last 7 days' },
  { value: '30d', label: '30d', description: 'Last 30 days' },
  { value: 'all', label: 'All', description: 'All time' },
];

const PERIOD_LABEL: Record<Period, string> = {
  '24h': 'the last 24 hours',
  '7d': 'the last 7 days',
  '30d': 'the last 30 days',
  all: 'all time',
};

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const analytics = useVideoAnalytics();

  const { refresh } = analytics;
  const handleRecorded = useCallback(() => refresh(), [refresh]);
  const simulator = useTrafficSimulator(handleRecorded);

  const { data, error, isInitialLoading, isFetching, query } = analytics;

  return (
    <div className={styles.shell}>
      <a className="skip-link" href="#content">
        Skip to content
      </a>

      <AppBar
        theme={theme}
        onToggleTheme={toggleTheme}
        onSimulate={() => void simulator.simulate()}
        isSimulating={simulator.isSimulating}
      />

      <main className={styles.main} id="content">
        <div className={styles.pageHead}>
          <div>
            <h1 className={styles.title}>Video performance</h1>
            <p className={styles.subtitle}>
              How each shoppable video moved shoppers from watching to buying over{' '}
              {PERIOD_LABEL[query.period]}.
            </p>
          </div>

          <SegmentedControl
            legend="Reporting period"
            options={PERIOD_OPTIONS}
            value={query.period}
            onChange={analytics.setPeriod}
          />
        </div>

        <FunnelStrip
          totals={data?.totals ?? null}
          period={query.period}
          search={query.search}
        />

        <AnalyticsTable
          rows={data?.data ?? []}
          sort={query.sort}
          order={query.order}
          onToggleSort={analytics.toggleSort}
          search={query.search}
          onSearchChange={analytics.setSearch}
          isInitialLoading={isInitialLoading}
          isFetching={isFetching}
          error={error}
          onRetry={refresh}
          highlightedVideoId={simulator.highlightedVideoId}
          periodLabel={PERIOD_LABEL[query.period]}
          footer={
            data ? (
              <Pagination
                pagination={data.pagination}
                onPageChange={analytics.setPage}
                onPageSizeChange={analytics.setPageSize}
              />
            ) : null
          }
        />
      </main>

      <Toaster />
    </div>
  );
}
