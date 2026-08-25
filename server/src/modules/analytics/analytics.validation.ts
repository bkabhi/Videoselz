import { z } from 'zod';
import { PERIODS, SORT_DIRECTIONS, SORT_FIELDS } from '@shared/api';
import { config } from '../../config.js';

/**
 * Query strings arrive as strings (or arrays, when a key repeats). `coerce`
 * handles the string→number conversion, and the defaults live here rather
 * than in the handler so the parsed object is always fully populated —
 * downstream code never has to re-check for `undefined`.
 */
export const videoAnalyticsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),

  pageSize: z.coerce
    .number()
    .int()
    .positive()
    // A hard ceiling: page size is caller-controlled, and an unbounded value
    // lets a single request pull the entire table into memory.
    .max(config.pagination.maxPageSize)
    .default(config.pagination.defaultPageSize),

  sort: z.enum(SORT_FIELDS).default('views'),
  order: z.enum(SORT_DIRECTIONS).default('desc'),
  period: z.enum(PERIODS).default('7d'),

  // Note: the transform runs for an absent value too, so `search` is always
  // `string | null` downstream and never `undefined`. `.default(null)` would
  // be wrong here — Zod feeds a default back through the inner schema, and
  // `null` is not a string.
  search: z
    .string()
    .trim()
    .max(120)
    .optional()
    // An empty string after trimming means "no filter", not "match empty".
    .transform((value) => (value && value.length > 0 ? value : null)),
});

export type VideoAnalyticsQueryInput = z.infer<typeof videoAnalyticsQuerySchema>;
