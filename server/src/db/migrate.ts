import fs from 'node:fs';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { applySchema, createConnection } from './client.js';

/**
 * Schema bootstrap. A single declarative `schema.sql` is the right size for
 * this project: there is one version of the schema and no production data to
 * migrate forward. `--fresh` drops the file so `db:reset` is deterministic.
 */
function migrate(): void {
  const fresh = process.argv.includes('--fresh');

  if (fresh && config.databaseFile !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) {
      const file = `${config.databaseFile}${suffix}`;
      if (fs.existsSync(file)) fs.rmSync(file);
    }
    logger.warn(`Dropped existing database at ${config.databaseFile}`);
  }

  const db = createConnection();
  applySchema(db);

  const tables = db
    .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .all() as Array<{ name: string }>;

  db.close();
  logger.success(`Schema applied — tables: ${tables.map((t) => t.name).join(', ')}`);
}

migrate();
