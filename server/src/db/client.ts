import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config, SCHEMA_PATH } from '../config.js';

export type Db = Database.Database;

let instance: Db | null = null;

/**
 * Applies the connection-level pragmas that every consumer needs.
 *
 * These are per-connection settings in SQLite, not persisted schema, so they
 * have to be re-applied every time a connection opens — including in tests.
 */
function configure(db: Db): Db {
  // SQLite ships with foreign keys OFF for backwards compatibility. Without
  // this, `video_id` could reference a row that does not exist.
  db.pragma('foreign_keys = ON');

  if (config.databaseFile !== ':memory:') {
    // WAL lets the dashboard's reads run concurrently with event ingestion
    // instead of blocking on the writer's lock.
    db.pragma('journal_mode = WAL');
    // NORMAL trades an fsync per commit for one per checkpoint. Safe under
    // WAL for everything short of an OS-level crash mid-write.
    db.pragma('synchronous = NORMAL');
  }

  // Fail fast rather than hanging forever if another process holds the lock.
  db.pragma('busy_timeout = 5000');
  return db;
}

/** Opens a fresh connection. Used by the test suite for isolated databases. */
export function createConnection(file: string = config.databaseFile): Db {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  return configure(new Database(file));
}

/** Process-wide connection. better-sqlite3 is synchronous, so a single
 *  connection is both sufficient and the fastest option — no pool needed. */
export function getDb(): Db {
  if (!instance) instance = createConnection();
  return instance;
}

/** Creates every table and index. Idempotent (`CREATE TABLE IF NOT EXISTS`). */
export function applySchema(db: Db): void {
  db.exec(fs.readFileSync(SCHEMA_PATH, 'utf8'));
}

export function closeDb(): void {
  instance?.close();
  instance = null;
}
