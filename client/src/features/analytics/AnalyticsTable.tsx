import { useMemo, type ReactNode } from 'react';
import type { SortDirection, SortField, VideoAnalyticsRow } from '@shared/api';
import { Button } from '@/components/Button';
import {
  AlertTriangle,
  EmptyFrame,
  Refresh,
  SortAscending,
  SortDescending,
} from '@/components/Icon';
import { SearchInput } from '@/components/SearchInput';
import {
  formatAbsoluteTime,
  formatCount,
  formatMoney,
  formatPercent,
  formatRelativeTime,
  safeRate,
} from '@/lib/format';
import type { ApiRequestError } from '@/lib/api';
import { TrendSparkline } from './TrendSparkline';
import styles from './AnalyticsTable.module.scss';

interface Column {
  id: SortField | 'trend';
  label: string;
  /** Right-aligned and tabular. */
  numeric?: boolean;
  sortable?: boolean;
  /** Hidden below the medium breakpoint. */
  optional?: boolean;
  /** Also hidden below the small breakpoint. */
  compactHidden?: boolean;
  /** Longer explanation attached to the header cell. */
  hint?: string;
}

const COLUMNS: Column[] = [
  { id: 'title', label: 'Video', sortable: true },
  { id: 'views', label: 'Views', numeric: true, sortable: true },
  { id: 'clicks', label: 'Clicks', numeric: true, sortable: true, compactHidden: true },
  {
    id: 'addToCarts',
    label: 'Add to carts',
    numeric: true,
    sortable: true,
    compactHidden: true,
  },
  {
    id: 'clickThroughRate',
    label: 'CTR',
    numeric: true,
    sortable: true,
    optional: true,
    hint: 'Click-through rate — clicks divided by views',
  },
  {
    id: 'conversionRate',
    label: 'Conv. rate',
    numeric: true,
    sortable: true,
    hint: 'Add to carts divided by views',
  },
  { id: 'trend', label: 'Trend', optional: true },
  { id: 'lastEventAt', label: 'Last activity', sortable: true, optional: true },
];

interface AnalyticsTableProps {
  rows: VideoAnalyticsRow[];
  sort: SortField;
  order: SortDirection;
  onToggleSort: (field: SortField) => void;
  search: string;
  onSearchChange: (value: string) => void;
  isInitialLoading: boolean;
  isFetching: boolean;
  error: ApiRequestError | null;
  onRetry: () => void;
  /** Video whose row should pulse, set by the traffic simulator. */
  highlightedVideoId: number | null;
  periodLabel: string;
  /**
   * Rendered inside the panel, below the table. A slot rather than baked-in
   * pagination props: the table's job is to render rows, and it has no reason
   * to know how the caller paginates them.
   */
  footer?: ReactNode;
}

export function AnalyticsTable({
  rows,
  sort,
  order,
  onToggleSort,
  search,
  onSearchChange,
  isInitialLoading,
  isFetching,
  error,
  onRetry,
  highlightedVideoId,
  periodLabel,
  footer,
}: AnalyticsTableProps) {
  // The conversion bars compare rows against the best performer on screen.
  // Against a theoretical 100% every real row would be an invisible sliver.
  const bestConversion = useMemo(() => {
    const rates = rows
      .map((row) => safeRate(row.addToCarts, row.views))
      .filter((rate): rate is number => rate !== null);
    return rates.length > 0 ? Math.max(...rates) : 0;
  }, [rows]);

  const showEmptyState = !isInitialLoading && !error && rows.length === 0;

  return (
    <section className={styles.panel} aria-labelledby="table-heading">
      <h2 className="visually-hidden" id="table-heading">
        Video performance table
      </h2>

      <div className={styles.toolbar}>
        <SearchInput
          value={search}
          onChange={onSearchChange}
          label="Search videos by title or product"
          placeholder="Search videos or products"
        />

        <div className={styles.toolbarEnd}>
          {/* Only shown for a background refresh — during the first load the
              skeleton already says the table is loading. */}
          {isFetching && !isInitialLoading ? (
            <span className={styles.refreshing}>
              <Refresh size={12} className={styles.refreshingIcon} />
              Updating
            </span>
          ) : null}
        </div>
      </div>

      {error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : showEmptyState ? (
        <EmptyState search={search} onClearSearch={() => onSearchChange('')} />
      ) : (
        <div className={styles.scroll}>
          <table className={styles.table}>
            <caption className="visually-hidden">
              Shoppable video performance for {periodLabel}, sorted by {sort} {order}ending.
            </caption>

            <thead>
              <tr>
                {COLUMNS.map((column) => (
                  <HeaderCell
                    key={column.id}
                    column={column}
                    sort={sort}
                    order={order}
                    onToggleSort={onToggleSort}
                  />
                ))}
              </tr>
            </thead>

            <tbody>
              {isInitialLoading
                ? Array.from({ length: 8 }, (_, index) => <SkeletonRow key={index} />)
                : rows.map((row) => (
                    <Row
                      key={row.videoId}
                      row={row}
                      bestConversion={bestConversion}
                      isHighlighted={row.videoId === highlightedVideoId}
                      periodLabel={periodLabel}
                    />
                  ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Hidden on the error state: there is nothing to page through, and a
          disabled pager under an error message is just noise. */}
      {!error ? footer : null}
    </section>
  );
}

/* ------------------------------------------------------------------------ */

function HeaderCell({
  column,
  sort,
  order,
  onToggleSort,
}: {
  column: Column;
  sort: SortField;
  order: SortDirection;
  onToggleSort: (field: SortField) => void;
}) {
  // `column.sortable` is optional, so `&&` yields boolean | undefined.
  const isActive = column.sortable === true && column.id === sort;

  const classes = [
    styles.headCell,
    column.numeric ? styles.numericHead : null,
    column.optional ? styles.optional : null,
    column.compactHidden ? styles.compactHidden : null,
  ]
    .filter(Boolean)
    .join(' ');

  // aria-sort belongs on the cell, not the button, and must be absent (not
  // "none") on columns that cannot be sorted at all.
  const ariaSort = column.sortable
    ? isActive
      ? order === 'asc'
        ? 'ascending'
        : 'descending'
      : 'none'
    : undefined;

  return (
    <th scope="col" className={classes} aria-sort={ariaSort}>
      {column.sortable ? (
        <button
          type="button"
          className={styles.sortButton}
          onClick={() => onToggleSort(column.id as SortField)}
          title={column.hint}
        >
          {/* Numeric headers put the indicator on the left of the label so the
              label itself stays flush with the right-aligned digits below. */}
          {column.numeric ? <SortGlyph active={isActive} order={order} /> : null}
          {column.label}
          {/* The hint is appended to the name rather than supplied via `title`
              alone. As a title it would *replace* "CTR" as the accessible
              name, and it would never reach a touch user at all. */}
          {column.hint ? <span className="visually-hidden">, {column.hint}</span> : null}
          {!column.numeric ? <SortGlyph active={isActive} order={order} /> : null}
        </button>
      ) : (
        <span className={styles.staticHead} title={column.hint}>
          {column.label}
        </span>
      )}
    </th>
  );
}

function SortGlyph({ active, order }: { active: boolean; order: SortDirection }) {
  const Glyph = active && order === 'asc' ? SortAscending : SortDescending;
  return (
    <Glyph
      size={12}
      className={`${styles.sortIcon} ${active ? styles.sortActive : ''}`}
    />
  );
}

/* ------------------------------------------------------------------------ */

function Row({
  row,
  bestConversion,
  isHighlighted,
  periodLabel,
}: {
  row: VideoAnalyticsRow;
  bestConversion: number;
  isHighlighted: boolean;
  periodLabel: string;
}) {
  // Both rates are derived here, in the client, from the raw counts the API
  // returned — per the brief, and so the definition of "conversion" is visible
  // at the point it is displayed.
  const clickThrough = safeRate(row.clicks, row.views);
  const conversion = safeRate(row.addToCarts, row.views);

  const barWidth =
    conversion !== null && bestConversion > 0
      ? Math.max(4, (conversion / bestConversion) * 100)
      : 0;

  return (
    <tr className={`${styles.row} ${isHighlighted ? styles.rowPulse : ''}`}>
      <th scope="row" className={`${styles.cell} ${styles.videoCell}`}>
        <span className={styles.videoTitle} title={row.title}>
          {row.title}
        </span>
        <span className={styles.videoMeta}>
          <span className={styles.productName}>{row.product.name}</span>
          <span className={styles.price}>
            {formatMoney(row.product.priceCents, row.product.currency)}
          </span>
        </span>
      </th>

      <td className={`${styles.cell} ${styles.numeric}`}>{formatCount(row.views)}</td>
      <td className={`${styles.cell} ${styles.numeric} ${styles.compactHidden}`}>
        {formatCount(row.clicks)}
      </td>
      <td className={`${styles.cell} ${styles.numeric} ${styles.compactHidden}`}>
        {formatCount(row.addToCarts)}
      </td>

      <td className={`${styles.cell} ${styles.numeric} ${styles.muted} ${styles.optional}`}>
        {formatPercent(clickThrough)}
      </td>

      <td className={`${styles.cell} ${styles.numeric}`}>
        <span className={styles.conversion}>
          <span
            className={`${styles.conversionValue} ${
              conversion === null ? styles.conversionNull : ''
            }`}
            // A video with no views has an *unknown* conversion rate, not a
            // zero one. The em dash says so, and the tooltip explains it.
            title={conversion === null ? 'No views yet — conversion rate is undefined' : undefined}
          >
            {formatPercent(conversion)}
          </span>
          {conversion !== null ? (
            <span className={styles.conversionTrack} aria-hidden="true">
              <span className={styles.conversionFill} style={{ width: `${barWidth}%` }} />
            </span>
          ) : null}
        </span>
      </td>

      <td className={`${styles.cell} ${styles.optional}`}>
        <TrendSparkline
          series={row.trend}
          seriesLabel={`Views for ${row.title} over ${periodLabel.toLowerCase()}`}
        />
      </td>

      <td className={`${styles.cell} ${styles.muted} ${styles.optional}`}>
        <time
          dateTime={row.lastEventAt ?? undefined}
          title={formatAbsoluteTime(row.lastEventAt)}
        >
          {formatRelativeTime(row.lastEventAt)}
        </time>
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------------ */

function SkeletonRow() {
  return (
    <tr className={styles.row} aria-hidden="true">
      <td className={`${styles.cell} ${styles.videoCell}`}>
        <div className={`${styles.skeleton} ${styles.skeletonWide}`} />
        <div className={`${styles.skeleton} ${styles.skeletonNarrow}`} />
      </td>
      {/* Views, then clicks and add-to-carts, which drop at the same
          breakpoints as their real counterparts. */}
      <td className={styles.cell}>
        <div className={`${styles.skeleton} ${styles.skeletonRight}`} />
      </td>
      {Array.from({ length: 2 }, (_, index) => (
        <td className={`${styles.cell} ${styles.compactHidden}`} key={index}>
          <div className={`${styles.skeleton} ${styles.skeletonRight}`} />
        </td>
      ))}
      {Array.from({ length: 4 }, (_, index) => (
        <td className={`${styles.cell} ${index === 3 ? '' : styles.optional}`} key={index}>
          <div className={`${styles.skeleton} ${styles.skeletonRight}`} />
        </td>
      ))}
    </tr>
  );
}

function EmptyState({ search, onClearSearch }: { search: string; onClearSearch: () => void }) {
  // Two genuinely different situations. "No results for a search" is a dead
  // end the user can back out of; "no videos at all" is a setup problem with a
  // different fix, and telling a merchant the wrong one wastes their time.
  if (search) {
    return (
      <div className={styles.state}>
        <EmptyFrame className={styles.stateIcon} />
        <p className={styles.stateTitle}>No videos match “{search}”</p>
        <p className={styles.stateBody}>
          Search looks at video titles and product names. Try a shorter term, or clear the
          search to see the whole catalogue.
        </p>
        <div className={styles.stateAction}>
          <Button onClick={onClearSearch}>Clear search</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.state}>
      <EmptyFrame className={styles.stateIcon} />
      <p className={styles.stateTitle}>No videos yet</p>
      <p className={styles.stateBody}>
        Once a shoppable video is published to your storefront it appears here, along with
        its views, clicks and add-to-carts. Seed the demo catalogue with{' '}
        <code>npm run db:seed</code>.
      </p>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: ApiRequestError; onRetry: () => void }) {
  return (
    <div className={styles.state} role="alert">
      <AlertTriangle size={26} className={`${styles.stateIcon} ${styles.errorIcon}`} />
      <p className={styles.stateTitle}>
        {error.isNetworkError ? 'Cannot reach the API' : 'Could not load analytics'}
      </p>
      {/* The server's own message names the problem; the UI adds the recovery
          rather than replacing what went wrong with something vague. */}
      <p className={styles.stateBody}>{error.message}</p>
      <div className={styles.stateAction}>
        <Button variant="secondary" onClick={onRetry}>
          <Refresh size={13} />
          Try again
        </Button>
      </div>
    </div>
  );
}
