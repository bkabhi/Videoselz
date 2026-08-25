import { Router } from 'express';
import type { CreateEventResponse } from '../../../../shared/api.js';
import type { Db } from '../../db/client.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { validateBody } from '../../middleware/validate.js';
import { createRateLimiter } from '../../middleware/rateLimit.js';
import { createEventSchema, type CreateEventInput } from './events.validation.js';
import { recordEvent } from './events.service.js';

export function createEventsRouter(db: Db): Router {
  const router = Router();

  /**
   * POST /api/events — ingest a single engagement event.
   *
   * Modelled on a storefront webhook: unauthenticated, rate-limited, and
   * strict about its payload. Responds 201 with the persisted row (including
   * the server-assigned id and resolved timestamp) so the caller can
   * reconcile without a follow-up read.
   */
  router.post(
    '/',
    createRateLimiter(),
    validateBody(createEventSchema),
    asyncHandler((req, res) => {
      const event = recordEvent(db, req.body as CreateEventInput);
      const body: CreateEventResponse = { data: event };
      res.status(201).json(body);
    }),
  );

  return router;
}
