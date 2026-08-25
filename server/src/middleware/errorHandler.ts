import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/ApiError.js';
import { logger } from '../lib/logger.js';

/** Terminal 404 for unmatched routes, so the client always gets JSON. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Cannot ${req.method} ${req.originalUrl}`));
}

/**
 * The single place an error becomes an HTTP response.
 *
 * Express identifies error middleware by arity, so `next` must stay in the
 * signature even though it is unused — dropping it silently turns this into a
 * normal handler that never runs.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof ApiError) {
    // 4xx is the caller's problem, not an incident: log it at warn, and only
    // when it is worth seeing.
    if (error.status >= 500) logger.error(`${req.method} ${req.originalUrl}`, error);
    res.status(error.status).json(error.toBody());
    return;
  }

  // A malformed JSON body surfaces as a SyntaxError from body-parser. Left
  // alone it becomes an opaque 500; a 400 naming the problem is honest.
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: { code: 'MALFORMED_JSON', message: 'Request body is not valid JSON.' },
    });
    return;
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, error);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      // Never leak a stack trace or driver message to a client in production.
      message:
        config.env === 'production'
          ? 'Something went wrong on our end.'
          : error instanceof Error
            ? error.message
            : 'Unknown error',
    },
  });
}
