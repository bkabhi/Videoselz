import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType, type ZodTypeDef } from 'zod';
import { ApiError } from '../lib/ApiError.js';

function toDetails(error: ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}

/*
 * Note the two type parameters on the helpers below. Several schemas
 * transform on the way through (`search` turns an absent value into `null`),
 * so a schema's input and output types differ. `ZodSchema<T>` collapses both
 * to `T` and will not accept them.
 */

/**
 * Parses `req.body` and replaces it with the typed, defaulted result.
 *
 * Validating in middleware — rather than at the top of each handler — means a
 * handler can only ever run against a payload that already passed the schema,
 * so the handler body has no defensive branches in it.
 */
export function validateBody<TOut, TIn>(schema: ZodType<TOut, ZodTypeDef, TIn>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(ApiError.validation('The request body failed validation.', toDetails(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

/**
 * Same for query strings. The parsed value is attached to `res.locals` rather
 * than assigned back to `req.query`, which is a getter-only property in
 * Express 5 and read-only under some proxies in 4.
 */
export function validateQuery<TOut, TIn>(schema: ZodType<TOut, ZodTypeDef, TIn>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(ApiError.badRequest('One or more query parameters are invalid.', toDetails(result.error)));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}

/** Reads the value `validateQuery` stashed. Typed at the call site. */
export function parsedQuery<T>(res: Response): T {
  return res.locals.query as T;
}
