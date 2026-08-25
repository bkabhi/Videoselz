import type { Db } from '../../db/client.js';
import { ApiError } from '../../lib/ApiError.js';
import type { CreateEventInput } from './events.validation.js';
import { insertEvent, videoExists, type InsertedEvent } from './events.repository.js';

/** Rejects timestamps more than this far in the future as clock errors. */
const FUTURE_TOLERANCE_MS = 60_000;

export function recordEvent(db: Db, input: CreateEventInput): InsertedEvent {
  // The foreign key would also catch this, but SQLite's constraint error is
  // opaque ("FOREIGN KEY constraint failed") and maps to a 500 by default.
  // Checking here lets the caller get a 404 that names the problem.
  if (!videoExists(db, input.videoId)) {
    throw ApiError.notFound(`No video exists with id ${input.videoId}.`);
  }

  if (input.occurredAt) {
    const skew = new Date(input.occurredAt).getTime() - Date.now();
    if (skew > FUTURE_TOLERANCE_MS) {
      // A future-dated event silently disappears from every time-windowed
      // query, so it is better to reject it loudly at the door.
      throw ApiError.validation('occurredAt cannot be in the future.', [
        { path: 'occurredAt', message: 'Timestamp is ahead of server time.' },
      ]);
    }
  }

  return insertEvent(db, input);
}
