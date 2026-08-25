import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Walks up to the nearest directory containing a package.json.
 *
 * A plain `path.resolve(here, '..')` is only correct when running from source.
 * The build emits to `server/dist/server/src/`, so the same expression would
 * resolve to `server/dist/server` and quietly point `npm start` at a *second,
 * empty* database — the app would run and show no videos, with nothing
 * obviously broken. Anchoring on the workspace manifest gives `server/` in
 * both modes.
 */
function findWorkspaceRoot(from: string): string {
  let dir = from;
  for (;;) {
    if (fs.existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return from; // filesystem root — give up gracefully
    dir = parent;
  }
}

const serverRoot = findWorkspaceRoot(here);

function intFromEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  /**
   * `API_PORT` takes precedence over `PORT`.
   *
   * `PORT` is ambient in a lot of tooling — task runners, IDE preview panes
   * and CI harnesses all set it — and honouring it blindly let the API bind
   * to the Vite dev server's port. `API_PORT` is unambiguous, while the
   * `PORT` fallback keeps the app deployable on hosts that only set that.
   */
  port: intFromEnv('API_PORT', intFromEnv('PORT', 4400)),

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

/**
 * Resolved next to the compiled module, not to the source tree, so a built
 * server does not depend on `src/` still being present. `npm run build` copies
 * the file into dist — `tsc` only emits TypeScript and ignores other assets.
 */
export const SCHEMA_PATH = path.join(here, 'db', 'schema.sql');
