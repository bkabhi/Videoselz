import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from '../lib/ApiError.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * A fixed-window limiter for the ingest endpoint.
 *
 * `POST /api/events` is the one route a third party posts to unauthenticated,
 * so it gets a ceiling. This is intentionally in-process: a single-node
 * take-home does not need Redis, and pulling in `express-rate-limit` for
 * thirty lines of logic is a dependency I would have to justify. In a real
 * multi-instance deployment this moves to a shared store — the per-instance
 * counter here would let N instances allow N × the limit.
 */
export function createRateLimiter(options = config.rateLimit) {
  const buckets = new Map<string, Bucket>();

  // Without eviction the map grows once per unique client forever.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, options.windowMs);
  // Do not hold the event loop open on shutdown.
  sweep.unref?.();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Remaining', options.maxRequests - 1);
      next();
      return;
    }

    bucket.count += 1;

    if (bucket.count > options.maxRequests) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfter);
      next(
        ApiError.tooManyRequests(
          `Too many events. Try again in ${retryAfter} second${retryAfter === 1 ? '' : 's'}.`,
        ),
      );
      return;
    }

    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - bucket.count));
    next();
  };
}
