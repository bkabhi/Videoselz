import { Router } from 'express';
import type { VideoListResponse } from '../../../../shared/api.js';
import type { Db } from '../../db/client.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { listVideos } from '../analytics/analytics.repository.js';

export function createVideosRouter(db: Db): Router {
  const router = Router();

  /**
   * GET /api/videos — id/title lookup list.
   *
   * The traffic simulator needs a real video id to post against. Reading the
   * ids from the analytics table would only ever cover the current page, so
   * the simulator would be unable to touch a video the merchant has paged
   * past. This returns the full (small) list instead.
   */
  router.get(
    '/',
    asyncHandler((_req, res) => {
      const body: VideoListResponse = { data: listVideos(db) };
      res.json(body);
    }),
  );

  return router;
}
