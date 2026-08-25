import { z } from 'zod';
import { EVENT_TYPES } from '../../../../shared/api.js';

/**
 * Ingest payload for `POST /api/events`.
 *
 * `strict()` rejects unknown keys rather than silently dropping them. For a
 * webhook surface that is the kinder failure: a caller who typos `video_id`
 * gets a 422 naming the field instead of a 201 that quietly recorded nothing
 * useful.
 */
export const createEventSchema = z
  .object({
    // `z.coerce.number()` would run `Number(undefined)` and report the far
    // less helpful "expected number, received nan" for a *missing* field.
    // Preprocessing only strings keeps the missing-vs-malformed distinction.
    videoId: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() !== '' ? Number(value) : value),
      z
        .number({
          required_error: 'videoId is required',
          invalid_type_error: 'videoId must be a number',
        })
        .int('videoId must be an integer')
        .positive('videoId must be a positive integer'),
    ),

    eventType: z.enum(EVENT_TYPES, {
      errorMap: () => ({ message: `eventType must be one of: ${EVENT_TYPES.join(', ')}` }),
    }),

    occurredAt: z
      .string()
      .datetime({ offset: true, message: 'occurredAt must be an ISO-8601 datetime' })
      .optional()
      // Normalise every timestamp to UTC on the way in. Storing mixed offsets
      // would make the lexicographic string comparison used by the time-window
      // filters incorrect.
      .transform((value) => (value ? new Date(value).toISOString() : undefined)),
  })
  .strict();

export type CreateEventInput = z.infer<typeof createEventSchema>;
