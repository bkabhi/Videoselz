import express, { type Express } from 'express';
import cors from 'cors';
import type { HealthResponse } from '../../shared/api.js';
import { config } from './config.js';
import type { Db } from './db/client.js';
import { asyncHandler } from './lib/asyncHandler.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/requestLogger.js';
import { createEventsRouter } from './modules/events/events.routes.js';
import { createAnalyticsRouter } from './modules/analytics/analytics.routes.js';
import { createVideosRouter } from './modules/videos/videos.routes.js';

/**
 * Builds the Express app around an injected database handle.
 *
 * The app is a factory rather than a module-level singleton so the test suite
 * can hand it a fresh in-memory database. That one decision is what lets the
 * API be tested end-to-end (real routing, real middleware, real SQL) without
 * mocks and without touching the developer's working database file.
 */
export function createApp(db: Db): Express {
  const app = express();

  // Express trusts no proxy by default, which makes `req.ip` the socket
  // address. Correct for local dev; behind a load balancer this needs the
  // real hop count, not `true` (which would let clients spoof X-Forwarded-For).
  app.set('trust proxy', false);
  app.disable('x-powered-by');

  app.use(cors({ origin: config.corsOrigins, methods: ['GET', 'POST'] }));
  app.use(express.json({ limit: '64kb' }));
  app.use(requestLogger);

  const startedAt = Date.now();

  app.get(
    '/api/health',
    asyncHandler((_req, res) => {
      const counts = db
        .prepare(
          `SELECT
             (SELECT COUNT(*) FROM products)          AS products,
             (SELECT COUNT(*) FROM videos)            AS videos,
             (SELECT COUNT(*) FROM engagement_events) AS events`,
        )
        .get() as HealthResponse['counts'];

      const body: HealthResponse = {
        status: 'ok',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        database: 'connected',
        counts,
      };
      res.json(body);
    }),
  );

  app.use('/api/events', createEventsRouter(db));
  app.use('/api/analytics', createAnalyticsRouter(db));
  app.use('/api/videos', createVideosRouter(db));

  // Order is load-bearing: the catch-all must sit after every route, and the
  // error handler after everything.
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
