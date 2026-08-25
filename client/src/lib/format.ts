/**
 * Every number the interface prints goes through this module.
 *
 * Centralising it is what keeps 1,240 from appearing as 1240 three screens
 * later, and it is where the zero-denominator cases are handled once instead
 * of at every call site.
 */

const compactNumber = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

const plainNumber = new Intl.NumberFormat('en-US');

/** Below 10,000 the exact figure fits and is more useful than "9.9K". */
export function formatCount(value: number): string {
  return value < 10_000 ? plainNumber.format(value) : compactNumber.format(value);
}

export function formatExactCount(value: number): string {
  return plainNumber.format(value);
}

/** Minor units to a currency string. Money is never stored as a float. */
export function formatMoney(minorUnits: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

/**
 * A ratio, or `null` when the denominator is zero.
 *
 * `null` rather than `0` is the whole point: a video with no views has an
 * *unknown* conversion rate, not a 0% one. Collapsing the two would tell a
 * merchant their new video is failing when it simply has not been seen.
 */
export function safeRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return numerator / denominator;
}

const percentFormatter = new Intl.NumberFormat('en-US', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Renders a ratio, or an em dash when it is undefined. */
export function formatPercent(rate: number | null): string {
  if (rate === null) return '—';
  return percentFormatter.format(rate);
}

const relativeFormatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000_000],
  ['month', 2_592_000_000],
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/** "3 hours ago", "just now", or "Never" for a null timestamp. */
export function formatRelativeTime(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'Never';

  const elapsed = now - Date.parse(iso);
  if (!Number.isFinite(elapsed)) return 'Unknown';
  if (elapsed < 60_000) return 'Just now';

  for (const [unit, ms] of RELATIVE_UNITS) {
    if (elapsed >= ms) {
      return relativeFormatter.format(-Math.floor(elapsed / ms), unit);
    }
  }
  return 'Just now';
}

/** Full timestamp for the `title` attribute behind a relative time. */
export function formatAbsoluteTime(iso: string | null): string {
  if (!iso) return 'No events recorded';
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

export const EVENT_TYPE_LABEL = {
  view: 'view',
  click: 'click',
  add_to_cart: 'add to cart',
} as const;

/** "view, click and add to cart" — for the simulator's confirmation copy. */
export function joinWithAnd(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0] as string;
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/**
 * Percentage change between the first and second half of a series.
 *
 * Used for the trend column's spoken label. Returns `null` when the earlier
 * half is empty — growth from zero is not a percentage.
 */
export function trendDirection(series: number[]): {
  change: number | null;
  direction: 'up' | 'down' | 'flat';
} {
  if (series.length < 2) return { change: null, direction: 'flat' };

  const midpoint = Math.floor(series.length / 2);
  const earlier = series.slice(0, midpoint).reduce((sum, n) => sum + n, 0);
  const later = series.slice(midpoint).reduce((sum, n) => sum + n, 0);

  if (earlier === 0) return { change: null, direction: later > 0 ? 'up' : 'flat' };

  const change = (later - earlier) / earlier;
  // A ±3% wobble is noise, not a trend. Calling it "flat" prevents the column
  // from shouting about meaningless movement.
  if (Math.abs(change) < 0.03) return { change, direction: 'flat' };
  return { change, direction: change > 0 ? 'up' : 'down' };
}
