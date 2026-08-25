-- ---------------------------------------------------------------------------
-- Videoselz — shoppable video analytics schema (SQLite)
--
-- Normalisation notes
--   * Third normal form: a product's name/price live only on `products`; a
--     video carries only the product's id. No metric is stored on `videos` —
--     every count in the dashboard is derived from `engagement_events`, so
--     there is no denormalised counter that can drift from the event log.
--   * `engagement_events` is an append-only fact table. Events are never
--     updated or deleted in normal operation, which is what makes it safe to
--     treat it as the single source of analytical truth.
-- ---------------------------------------------------------------------------

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  -- Money is stored in minor units (cents) as an INTEGER. SQLite's REAL is an
  -- IEEE-754 double; 19.99 is not representable in binary floating point and
  -- summing such values drifts. Cents keeps arithmetic exact.
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency    TEXT    NOT NULL DEFAULT 'USD' CHECK (length(currency) = 3),
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS videos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id    INTEGER NOT NULL,
  title         TEXT    NOT NULL,
  video_url     TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  -- A video belongs to exactly one product. Removing the product removes its
  -- videos, and the events cascade from there.
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- The analytics query joins videos -> products and filters/sorts by product,
-- so the FK column needs its own index (SQLite does not create one implicitly).
CREATE INDEX IF NOT EXISTS idx_videos_product_id ON videos(product_id);

CREATE TABLE IF NOT EXISTS engagement_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id    INTEGER NOT NULL,
  -- Enforced in the database as well as in the request validator: the API is
  -- not the only thing that writes here (seeds, future importers, manual SQL).
  event_type  TEXT    NOT NULL CHECK (event_type IN ('view', 'click', 'add_to_cart')),
  occurred_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),

  FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Covers the dashboard's hot path: "for this video, in this window, count by
-- type". Ordering the columns video_id -> occurred_at -> event_type lets the
-- same index serve the per-video rollup and the windowed daily trend.
CREATE INDEX IF NOT EXISTS idx_events_video_time
  ON engagement_events(video_id, occurred_at, event_type);

-- Serves the window-wide totals strip, which filters on time alone.
CREATE INDEX IF NOT EXISTS idx_events_occurred_at
  ON engagement_events(occurred_at);
