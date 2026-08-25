import { config } from './config.js';
import { createApp } from './app.js';
import { applySchema, closeDb, getDb } from './db/client.js';
import { logger } from './lib/logger.js';

const db = getDb();

// Cheap safety net: a developer who clones and runs `npm run dev` before
// `db:migrate` gets a working (empty) API instead of "no such table".
applySchema(db);

const rowCount = db.prepare('SELECT COUNT(*) AS count FROM videos').get() as { count: number };
if (rowCount.count === 0) {
  logger.warn('No videos found. Run `npm run db:seed` to populate the dashboard.');
}

const server = createApp(db).listen(config.port, () => {
  logger.success(`API listening on http://localhost:${config.port}`);
  logger.info(`Database: ${config.databaseFile}`);
});

/** Drain in-flight requests and release the SQLite handle before exiting. */
function shutdown(signal: string): void {
  logger.warn(`${signal} received — shutting down`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  // Do not hang forever on a wedged connection.
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
