import { useId } from 'react';
import { ArrowDown, ArrowUp } from '@/components/Icon';
import { trendDirection } from '@/lib/format';
import styles from './TrendSparkline.module.scss';

const WIDTH = 68;
const HEIGHT = 22;
/** Keeps the stroke and the head marker inside the viewBox at the extremes. */
const PADDING = 2.5;

interface TrendSparklineProps {
  series: number[];
  /** Named in the accessible label, e.g. "views over the last 7 days". */
  seriesLabel: string;
}

/**
 * A 7/24/30-bucket view trend.
 *
 * This carries real data — the merchant's actual daily view counts — and
 * answers a question the raw totals cannot: is this video picking up or
 * fading? A sparkline that stood in for content rather than reporting it
 * would not belong here.
 */
export function TrendSparkline({ series, seriesLabel }: TrendSparklineProps) {
  const gradientId = useId();
  const { change, direction } = trendDirection(series);

  const total = series.reduce((sum, value) => sum + value, 0);
  if (series.length < 2 || total === 0) {
    return <span className={styles.empty}>No activity</span>;
  }

  const max = Math.max(...series);
  const stepX = (WIDTH - PADDING * 2) / (series.length - 1);

  const points = series.map((value, index) => {
    const x = PADDING + index * stepX;
    // A flat series should sit mid-height rather than pinned to the floor,
    // which would read as zero.
    const ratio = max === 0 ? 0.5 : value / max;
    const y = HEIGHT - PADDING - ratio * (HEIGHT - PADDING * 2);
    return { x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');

  const areaPath = `${linePath} L${points.at(-1)?.x.toFixed(2)} ${HEIGHT} L${points[0]?.x.toFixed(2)} ${HEIGHT} Z`;

  const head = points.at(-1);

  const spokenChange =
    change === null
      ? 'no comparable earlier period'
      : `${direction === 'up' ? 'up' : direction === 'down' ? 'down' : 'flat at'} ${Math.abs(
          Math.round(change * 100),
        )} percent`;

  return (
    <span className={styles.wrapper}>
      <svg
        className={styles.chart}
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        // The chart is the content here, not decoration, so it gets a real
        // accessible name describing what the shape shows.
        role="img"
        aria-label={`${seriesLabel}: ${total} total, ${spokenChange}`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path className={styles.line} d={linePath} />
        {head ? <circle className={styles.head} cx={head.x} cy={head.y} r="1.9" /> : null}
      </svg>

      {/* Direction is stated in text and in a glyph, never in colour alone. */}
      <span
        className={[
          styles.delta,
          direction === 'up' ? styles.up : null,
          direction === 'down' ? styles.down : null,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      >
        {direction === 'up' ? <ArrowUp size={10} /> : null}
        {direction === 'down' ? <ArrowDown size={10} /> : null}
        {change === null ? 'new' : `${Math.abs(Math.round(change * 100))}%`}
      </span>
    </span>
  );
}
