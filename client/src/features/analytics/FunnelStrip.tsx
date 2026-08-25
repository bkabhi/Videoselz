import type { CSSProperties } from 'react';
import type { AnalyticsTotals, Period } from '@shared/api';
import { formatExactCount, formatPercent, safeRate } from '@/lib/format';
import styles from './FunnelStrip.module.scss';

const PERIOD_LABEL: Record<Period, string> = {
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  all: 'All time',
};

interface FunnelStripProps {
  totals: AnalyticsTotals | null;
  period: Period;
  search: string;
}

interface Stage {
  key: 'views' | 'clicks' | 'addToCarts';
  label: string;
  count: number;
  swatch: string;
}

export function FunnelStrip({ totals, period, search }: FunnelStripProps) {
  if (!totals) return <FunnelSkeleton />;

  const stages: Stage[] = [
    { key: 'views', label: 'Views', count: totals.views, swatch: 'var(--funnel-1)' },
    { key: 'clicks', label: 'Clicks', count: totals.clicks, swatch: 'var(--funnel-2)' },
    {
      key: 'addToCarts',
      label: 'Add to carts',
      count: totals.addToCarts,
      swatch: 'var(--funnel-3)',
    },
  ];

  // Every bar is measured against views, the top of the funnel. Scaling each
  // bar to its own maximum instead would make three very different numbers
  // look identical, which is the opposite of what the strip is for.
  const top = totals.views;

  const clickThrough = safeRate(totals.clicks, totals.views);
  const cartRate = safeRate(totals.addToCarts, totals.views);
  const clickToCart = safeRate(totals.addToCarts, totals.clicks);

  const scope = search
    ? `${PERIOD_LABEL[period]} · ${totals.videos} matching ${totals.videos === 1 ? 'video' : 'videos'}`
    : `${PERIOD_LABEL[period]} · ${totals.videos} ${totals.videos === 1 ? 'video' : 'videos'}`;

  return (
    <section className={styles.panel} aria-labelledby="funnel-heading">
      <header className={styles.header}>
        <h2 className={styles.heading} id="funnel-heading">
          Engagement funnel
        </h2>
        <p className={styles.scope}>{scope}</p>
      </header>

      <div className={styles.stages}>
        {stages.map((stage) => {
          const share = safeRate(stage.count, top);
          return (
            <div className={styles.stage} key={stage.key}>
              <span className={styles.stageLabel}>
                <span className={styles.swatch} style={{ backgroundColor: stage.swatch }} />
                {stage.label}
              </span>

              {/* The bar is decorative: the figures beside it carry the same
                  information in text, so a screen reader is not read a
                  meaningless progress value. */}
              <div className={styles.track} aria-hidden="true">
                <div
                  className={styles.fill}
                  style={
                    {
                      '--fill': `${(share ?? 0) * 100}%`,
                      backgroundColor: stage.swatch,
                    } as CSSProperties
                  }
                />
              </div>

              <div className={styles.figures}>
                <span className={styles.count}>{formatExactCount(stage.count)}</span>
                <span className={styles.share}>
                  {/* Views is 100% *of itself* — but only when there are any.
                      Printing "100%" against a count of zero states a share
                      of nothing, which is the same class of mistake as
                      rendering 0/0 as 0%. */}
                  {stage.key === 'views'
                    ? top > 0
                      ? '100%'
                      : '—'
                    : formatPercent(share)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className={styles.summary}>
        <p className={styles.stat}>
          <span className={styles.statLabel}>Click-through</span>
          <span className={styles.statValue}>{formatPercent(clickThrough)}</span>
        </p>
        <p className={styles.stat}>
          <span className={styles.statLabel}>Click to cart</span>
          <span className={styles.statValue}>{formatPercent(clickToCart)}</span>
        </p>
        <p className={styles.stat}>
          <span className={styles.statLabel}>Conversion rate</span>
          <span className={`${styles.statValue} ${styles.statHighlight}`}>
            {formatPercent(cartRate)}
          </span>
        </p>
      </div>
    </section>
  );
}

function FunnelSkeleton() {
  return (
    <section className={styles.panel} aria-busy="true" aria-label="Loading engagement funnel">
      <header className={styles.header}>
        <h2 className={styles.heading}>Engagement funnel</h2>
      </header>

      <div className={styles.stages}>
        {['views', 'clicks', 'carts'].map((key) => (
          <div className={styles.stage} key={key}>
            <span className={styles.stageLabel} />
            <div className={styles.skeletonBar} />
            <div className={styles.figures}>
              <span className={styles.skeletonCount} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
