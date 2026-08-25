import type { Db } from '../../db/client.js';
import type { EventType } from '../../../../shared/api.js';

export interface InsertedEvent {
  id: number;
  videoId: number;
  eventType: EventType;
  occurredAt: string;
}

export function videoExists(db: Db, videoId: number): boolean {
  const row = db.prepare('SELECT 1 AS present FROM videos WHERE id = ?').get(videoId);
  return row !== undefined;
}

export function insertEvent(
  db: Db,
  input: { videoId: number; eventType: EventType; occurredAt?: string },
): InsertedEvent {
  const occurredAt = input.occurredAt ?? new Date().toISOString();

  const result = db
    .prepare(
      `INSERT INTO engagement_events (video_id, event_type, occurred_at)
       VALUES (@videoId, @eventType, @occurredAt)`,
    )
    .run({ videoId: input.videoId, eventType: input.eventType, occurredAt });

  return {
    id: Number(result.lastInsertRowid),
    videoId: input.videoId,
    eventType: input.eventType,
    occurredAt,
  };
}
