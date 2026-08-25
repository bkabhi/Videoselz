import type { Db } from './client.js';
import { applySchema, createConnection } from './client.js';
import { logger } from '../lib/logger.js';

/* --------------------------------------------------------------------- */
/* Deterministic randomness                                              */
/* --------------------------------------------------------------------- */

/**
 * mulberry32 — a small, fast, seeded PRNG.
 *
 * The seed is fixed so `npm run db:seed` produces byte-identical data on every
 * machine. A reviewer's screenshots match mine, and a failing test is
 * reproducible instead of "flaky".
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(0x5eed_1234);

const randomInt = (min: number, max: number): number =>
  Math.floor(random() * (max - min + 1)) + min;

const chance = (probability: number): boolean => random() < probability;

const pick = <T>(items: readonly T[]): T => items[randomInt(0, items.length - 1)] as T;

/* --------------------------------------------------------------------- */
/* Catalogue                                                             */
/* --------------------------------------------------------------------- */

interface ProductSeed {
  name: string;
  priceCents: number;
  videos: Array<{ title: string; slug: string }>;
  /**
   * How well this video's audience converts, 0–1. Real catalogues are not
   * uniform: a demo of a $28 product behaves nothing like a $340 one, and a
   * dashboard whose rows all sit at the same conversion rate teaches the
   * merchant nothing.
   */
  quality: number;
  /** Relative share of total traffic. */
  reach: number;
}

const CATALOGUE: ProductSeed[] = [
  {
    name: 'Meridian Linen Shirt',
    priceCents: 12800,
    quality: 0.78,
    reach: 1.4,
    videos: [
      { title: 'How the linen softens after three washes', slug: 'meridian-linen-wash-test' },
      { title: 'Styling the Meridian three ways', slug: 'meridian-styling-three-ways' },
    ],
  },
  {
    name: 'Kestrel Weekender Duffel',
    priceCents: 24500,
    quality: 0.62,
    reach: 1.1,
    videos: [{ title: 'Packing five days into the Kestrel', slug: 'kestrel-five-day-pack' }],
  },
  {
    name: 'Aster Ceramic Pour-Over',
    priceCents: 6400,
    quality: 0.91,
    reach: 1.6,
    videos: [
      { title: 'A full pour-over, start to finish', slug: 'aster-full-pourover' },
      { title: 'Why the spout angle matters', slug: 'aster-spout-angle' },
    ],
  },
  {
    name: 'Halden Merino Crew',
    priceCents: 15900,
    quality: 0.54,
    reach: 0.9,
    videos: [{ title: 'Merino after a week of wear', slug: 'halden-week-of-wear' }],
  },
  {
    name: 'Volkano Cast Iron Skillet',
    priceCents: 8900,
    quality: 0.73,
    reach: 1.2,
    videos: [{ title: 'Seasoning a skillet in real time', slug: 'volkano-seasoning' }],
  },
  {
    name: 'Tessellate Wool Rug 5×8',
    priceCents: 46000,
    quality: 0.31,
    reach: 0.7,
    videos: [{ title: 'The rug in four different rooms', slug: 'tessellate-four-rooms' }],
  },
  {
    name: 'Nocturne Silk Sleep Set',
    priceCents: 18800,
    quality: 0.84,
    reach: 1.3,
    videos: [
      { title: 'The 60-second fabric close-up', slug: 'nocturne-fabric-closeup' },
      { title: 'Customer unboxing: Nocturne in slate', slug: 'nocturne-unboxing-slate' },
    ],
  },
  {
    name: 'Fieldnote Leather Journal',
    priceCents: 4200,
    quality: 0.68,
    reach: 1.0,
    videos: [{ title: 'Six months of patina, day by day', slug: 'fieldnote-patina' }],
  },
  {
    name: 'Cirrus Packable Rain Shell',
    priceCents: 21900,
    quality: 0.47,
    reach: 0.8,
    videos: [{ title: 'Twenty minutes under a hose', slug: 'cirrus-hose-test' }],
  },
  {
    name: 'Sable Walnut Cutting Board',
    priceCents: 11500,
    quality: 0.59,
    reach: 0.6,
    videos: [{ title: 'End grain vs. edge grain, cut for cut', slug: 'sable-end-grain' }],
  },
  {
    name: 'Lumen Rechargeable Table Lamp',
    priceCents: 13400,
    quality: 0.71,
    reach: 1.05,
    videos: [{ title: 'Every brightness step, on camera', slug: 'lumen-brightness-steps' }],
  },
  {
    name: 'Orrin Trail Runner',
    priceCents: 16800,
    quality: 0.0,
    reach: 0.0,
    // Deliberately traffic-free. A freshly published video is the state a
    // merchant sees most often on day one, and it is the row that breaks
    // naive conversion-rate maths (0 add-to-carts ÷ 0 views). The dashboard
    // has to render it honestly rather than printing "NaN%" or a false 0%.
    videos: [{ title: 'First look: the Orrin outsole', slug: 'orrin-first-look' }],
  },
];

/** Stable, obviously-fake CDN URLs. No external asset is fetched at runtime. */
const videoUrl = (slug: string): string => `https://cdn.videoselz.example/v1/clips/${slug}.mp4`;

/* --------------------------------------------------------------------- */
/* Event generation                                                      */
/* --------------------------------------------------------------------- */

const DAYS_OF_HISTORY = 30;

/**
 * Hourly traffic weights across a day, midnight → 23:00.
 *
 * Storefront traffic is not uniform. Weighting it means the daily trend line
 * and the "last activity" column look like a real store rather than a
 * flat random walk.
 */
const HOURLY_WEIGHT = [
  0.2, 0.1, 0.1, 0.1, 0.15, 0.3, 0.6, 1.0, 1.4, 1.6, 1.7, 1.8,
  1.9, 1.8, 1.7, 1.6, 1.7, 1.9, 2.2, 2.4, 2.1, 1.5, 0.9, 0.4,
];

const WEIGHT_TOTAL = HOURLY_WEIGHT.reduce((sum, weight) => sum + weight, 0);

/** Samples an hour from the weighted distribution above. */
function sampleHour(): number {
  let threshold = random() * WEIGHT_TOTAL;
  for (let hour = 0; hour < HOURLY_WEIGHT.length; hour += 1) {
    threshold -= HOURLY_WEIGHT[hour] as number;
    if (threshold <= 0) return hour;
  }
  return HOURLY_WEIGHT.length - 1;
}

const toIso = (date: Date): string => date.toISOString().replace('Z', 'Z');

interface GeneratedEvent {
  videoId: number;
  eventType: 'view' | 'click' | 'add_to_cart';
  occurredAt: string;
}

/**
 * Emits one storefront session as a funnel: every session starts with a view,
 * a fraction click through to the product, and a fraction of those add to
 * cart. Generating the funnel (rather than three independent event streams)
 * is what keeps clicks ≤ views and add-to-carts ≤ clicks — an invariant a
 * real merchant would notice immediately if it broke.
 */
function generateSession(videoId: number, quality: number, at: Date): GeneratedEvent[] {
  const events: GeneratedEvent[] = [
    { videoId, eventType: 'view', occurredAt: toIso(at) },
  ];

  // 6%–34% click-through, scaled by the video's quality.
  const clickThrough = 0.06 + quality * 0.28;
  if (!chance(clickThrough)) return events;

  // Clicks land 4–90 seconds after the view — long enough to have watched.
  const clickAt = new Date(at.getTime() + randomInt(4, 90) * 1000);
  events.push({ videoId, eventType: 'click', occurredAt: toIso(clickAt) });

  // 10%–52% of clicks convert.
  const cartRate = 0.1 + quality * 0.42;
  if (!chance(cartRate)) return events;

  const cartAt = new Date(clickAt.getTime() + randomInt(10, 240) * 1000);
  events.push({ videoId, eventType: 'add_to_cart', occurredAt: toIso(cartAt) });

  return events;
}

/* --------------------------------------------------------------------- */
/* Seed                                                                  */
/* --------------------------------------------------------------------- */

function seed(db: Db): void {
  applySchema(db);

  // Order matters: children first, so foreign keys never block the delete.
  db.exec('DELETE FROM engagement_events; DELETE FROM videos; DELETE FROM products;');
  db.exec("DELETE FROM sqlite_sequence WHERE name IN ('products','videos','engagement_events');");

  const insertProduct = db.prepare(
    `INSERT INTO products (name, price_cents, currency, created_at) VALUES (?, ?, 'USD', ?)`,
  );
  const insertVideo = db.prepare(
    `INSERT INTO videos (product_id, title, video_url, created_at) VALUES (?, ?, ?, ?)`,
  );
  const insertEvent = db.prepare(
    `INSERT INTO engagement_events (video_id, event_type, occurred_at) VALUES (?, ?, ?)`,
  );

  const now = new Date();
  const catalogueCreatedAt = new Date(now.getTime() - (DAYS_OF_HISTORY + 20) * 86_400_000);

  interface PlacedVideo {
    id: number;
    quality: number;
    reach: number;
  }
  const placed: PlacedVideo[] = [];

  // One transaction for the whole catalogue: better-sqlite3 commits per
  // statement otherwise, which turns a few thousand inserts into a few
  // thousand fsyncs.
  const writeCatalogue = db.transaction(() => {
    for (const product of CATALOGUE) {
      const productResult = insertProduct.run(
        product.name,
        product.priceCents,
        toIso(catalogueCreatedAt),
      );
      const productId = Number(productResult.lastInsertRowid);

      for (const video of product.videos) {
        // Videos are published across the history window, not all at once.
        const publishedAt = new Date(
          now.getTime() - randomInt(DAYS_OF_HISTORY - 2, DAYS_OF_HISTORY + 15) * 86_400_000,
        );
        const videoResult = insertVideo.run(
          productId,
          video.title,
          videoUrl(video.slug),
          toIso(publishedAt),
        );
        placed.push({
          id: Number(videoResult.lastInsertRowid),
          // Per-video jitter so two videos on the same product still differ.
          quality: Math.min(1, Math.max(0, product.quality + (random() - 0.5) * 0.12)),
          reach: product.reach,
        });
      }
    }
  });
  writeCatalogue();

  const events: GeneratedEvent[] = [];

  for (let daysAgo = DAYS_OF_HISTORY - 1; daysAgo >= 0; daysAgo -= 1) {
    const day = new Date(now.getTime() - daysAgo * 86_400_000);
    const weekday = day.getUTCDay();

    // Weekends run quieter; traffic grows ~1.8x across the window so the
    // trend sparklines have a direction instead of a flat average.
    const weekendFactor = weekday === 0 || weekday === 6 ? 0.68 : 1;
    const growthFactor = 0.6 + ((DAYS_OF_HISTORY - daysAgo) / DAYS_OF_HISTORY) * 1.2;

    for (const video of placed) {
      if (video.reach === 0) continue;

      const baseSessions = 14 * video.reach * weekendFactor * growthFactor;
      // ±35% day-to-day noise.
      const sessions = Math.max(0, Math.round(baseSessions * (0.65 + random() * 0.7)));

      for (let i = 0; i < sessions; i += 1) {
        const at = new Date(day);
        at.setUTCHours(sampleHour(), randomInt(0, 59), randomInt(0, 59), randomInt(0, 999));
        // Never emit an event in the future — `24h` filters would drop them.
        if (at.getTime() > now.getTime()) continue;
        events.push(...generateSession(video.id, video.quality, at));
      }
    }
  }

  // Chronological insert order keeps ids roughly time-ordered, which is what
  // an append-only event log looks like in production.
  events.sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  const writeEvents = db.transaction((batch: GeneratedEvent[]) => {
    for (const event of batch) {
      insertEvent.run(event.videoId, event.eventType, event.occurredAt);
    }
  });
  writeEvents(events);

  const counts = db
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM products)          AS products,
         (SELECT COUNT(*) FROM videos)            AS videos,
         (SELECT COUNT(*) FROM engagement_events) AS events`,
    )
    .get() as { products: number; videos: number; events: number };

  logger.success(
    `Seeded ${counts.products} products, ${counts.videos} videos, ` +
      `${counts.events.toLocaleString('en-US')} events across ${DAYS_OF_HISTORY} days`,
  );
  logger.info(`One video ("First look: the Orrin outsole") is intentionally traffic-free.`);
}

const db = createConnection();
seed(db);
db.close();
