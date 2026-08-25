import type { Db } from '../src/db/client.js';
import { applySchema, createConnection } from '../src/db/client.js';

/**
 * A fresh in-memory database per test file.
 *
 * `:memory:` gives every suite a private database that disappears with the
 * connection — no cleanup step, no cross-test bleed, and no risk of a test
 * run wiping the developer's seeded working database.
 */
export function createTestDb(): Db {
  const db = createConnection(':memory:');
  applySchema(db);
  return db;
}

export interface Fixture {
  productId: number;
  videoIds: number[];
}

/**
 * Two videos with hand-counted events, plus one video with none.
 *
 * The counts are deliberately asymmetric (7/3/2 vs 4/1/0) so an aggregation
 * bug that swaps columns or double-counts a join shows up as a wrong number
 * rather than coincidentally matching.
 *
 * Timestamps are anchored to the real clock rather than a fixed date, because
 * the period filters resolve their window from `Date.now()`. A hardcoded
 * anchor would drift out of every window as the calendar moved and quietly
 * turn the windowing assertions into a time bomb.
 */
export function seedFixture(db: Db, now = new Date()): Fixture {
  const insertProduct = db.prepare(
    `INSERT INTO products (name, price_cents, currency, created_at) VALUES (?, ?, ?, ?)`,
  );
  const insertVideo = db.prepare(
    `INSERT INTO videos (product_id, title, video_url, created_at) VALUES (?, ?, ?, ?)`,
  );
  const insertEvent = db.prepare(
    `INSERT INTO engagement_events (video_id, event_type, occurred_at) VALUES (?, ?, ?)`,
  );

  const iso = (offsetMs: number) => new Date(now.getTime() + offsetMs).toISOString();

  const productId = Number(insertProduct.run('Aster Pour-Over', 6400, 'USD', iso(-864e5 * 30)).lastInsertRowid);

  const alpha = Number(insertVideo.run(productId, 'Alpha brew guide', 'https://cdn.test/a.mp4', iso(-864e5 * 20)).lastInsertRowid);
  const beta = Number(insertVideo.run(productId, 'Beta spout detail', 'https://cdn.test/b.mp4', iso(-864e5 * 20)).lastInsertRowid);
  const quiet = Number(insertVideo.run(productId, 'Quiet unpublished clip', 'https://cdn.test/c.mp4', iso(-864e5 * 2)).lastInsertRowid);

  const write = db.transaction(() => {
    // Alpha: 7 views, 3 clicks, 2 add_to_carts  -> 28.57% conversion
    for (let i = 0; i < 7; i += 1) insertEvent.run(alpha, 'view', iso(-3600e3 * (i + 1)));
    for (let i = 0; i < 3; i += 1) insertEvent.run(alpha, 'click', iso(-3600e3 * (i + 1)));
    for (let i = 0; i < 2; i += 1) insertEvent.run(alpha, 'add_to_cart', iso(-3600e3 * (i + 1)));

    // Beta: 4 views, 1 click, 0 add_to_carts    -> 0% conversion
    for (let i = 0; i < 4; i += 1) insertEvent.run(beta, 'view', iso(-3600e3 * (i + 1)));
    insertEvent.run(beta, 'click', iso(-3600e3));

    // An old Alpha view, outside a 24h window but inside 7d.
    insertEvent.run(alpha, 'view', iso(-864e5 * 3));
  });
  write();

  return { productId, videoIds: [alpha, beta, quiet] };
}
