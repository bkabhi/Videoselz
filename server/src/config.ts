import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Repo-relative `server/` root, stable whether running via tsx or from dist. */
const serverRoot = path.resolve(here, '..');

function intFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: intFromEnv('PORT', 4400),

  /**
   * `:memory:` is used by the test suite so each run starts from a known
   * state without touching the developer's working database.
   */
  databaseFile: process.env.DATABASE_FILE ?? path.join(serverRoot, 'data', 'videoselz.db'),

  /** Vite dev server origins allowed to call the API directly. */
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  /** Ingest guard rails. The events endpoint is the public webhook surface. */
  rateLimit: {
    windowMs: intFromEnv('RATE_LIMIT_WINDOW_MS', 60_000),
    maxRequests: intFromEnv('RATE_LIMIT_MAX', 600),
  },

  pagination: {
    defaultPageSize: 10,
    maxPageSize: 100,
  },
} as const;

export const SCHEMA_PATH = path.join(here, 'db', 'schema.sql');
