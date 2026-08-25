import { Router } from 'express';
import type { VideoAnalyticsResponse } from '@shared/api';
import type { Db } from '../../db/client.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { parsedQuery, validateQuery } from '../../middleware/validate.js';
import { videoAnalyticsQuerySchema, type VideoAnalyticsQueryInput } from './analytics.validation.js';
import { buildVideoAnalytics } from './analytics.service.js';

export function createAnalyticsRouter(db: Db): Router {
  const router = Router();

  /**
   * GET /api/analytics/videos
   *
   * Every video with its view / click / add-to-cart totals for the selected
   * window, paginated. Conversion rate is deliberately *not* in the payload:
   * the brief specifies it as a client-side derivation, and returning raw
   * counts keeps the endpoint useful to callers that want a different ratio.
   *
   * Query: page, pageSize, sort, order, period, search
   */
  router.get(
    '/videos',
    validateQuery(videoAnalyticsQuerySchema),
    asyncHandler((_req, res) => {
      const query = parsedQuery<VideoAnalyticsQueryInput>(res);
      const body: VideoAnalyticsResponse = buildVideoAnalytics(db, query);

      // The dashboard polls this on every filter change; a short private
      // cache absorbs double-fires from React strict mode and rapid paging
      // without ever serving another user's window.
      res.setHeader('Cache-Control', 'private, max-age=2');
      res.json(body);
    }),
  );

  return router;
}
