import type { NextFunction, Request, Response } from 'express';
import { logger } from '../lib/logger.js';

/** One line per completed request, with duration. Skips the health probe so
 *  the header's connectivity poll does not drown the log. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/api/health') return next();

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms`;
    if (res.statusCode >= 500) logger.error(line);
    else if (res.statusCode >= 400) logger.warn(line);
    else logger.info(line);
  });

  next();
}
