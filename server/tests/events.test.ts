import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import { createTestDb, seedFixture } from './helpers.js';

let db: Db;
let app: Express;
let videoId: number;

beforeEach(() => {
  db?.close();
  db = createTestDb();
  videoId = seedFixture(db).videoIds[0] as number;
  app = createApp(db);
});

afterAll(() => db?.close());

describe('POST /api/events', () => {
  it('persists an event and returns it with a server-assigned id', async () => {
    const before = db.prepare('SELECT COUNT(*) AS n FROM engagement_events').get() as { n: number };

    const response = await request(app)
      .post('/api/events')
      .send({ videoId, eventType: 'add_to_cart' })
      .expect(201);

    expect(response.body.data).toMatchObject({ videoId, eventType: 'add_to_cart' });
    expect(response.body.data.id).toBeGreaterThan(0);
    // The response must reflect what was actually written, not just echo back
    // the request — a handler that returns 201 without inserting would pass a
    // shape-only assertion.
    const after = db.prepare('SELECT COUNT(*) AS n FROM engagement_events').get() as { n: number };
    expect(after.n).toBe(before.n + 1);
  });

  it('defaults occurredAt to now when omitted', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({ videoId, eventType: 'view' })
      .expect(201);

    const drift = Math.abs(Date.parse(response.body.data.occurredAt) - Date.now());
    expect(drift).toBeLessThan(5_000);
  });

  it('accepts and normalises a supplied offset timestamp to UTC', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({ videoId, eventType: 'click', occurredAt: '2026-08-20T10:30:00+02:00' })
      .expect(201);

    expect(response.body.data.occurredAt).toBe('2026-08-20T08:30:00.000Z');
  });

  it('coerces a numeric string videoId', async () => {
    await request(app)
      .post('/api/events')
      .send({ videoId: String(videoId), eventType: 'view' })
      .expect(201);
  });

  it('rejects an unknown event type with a 422 that names the field', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({ videoId, eventType: 'purchase' })
      .expect(422);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'eventType' })]),
    );
  });

  it('reports a missing videoId as required rather than as NaN', async () => {
    const response = await request(app).post('/api/events').send({ eventType: 'view' }).expect(422);
    expect(response.body.error.details[0]).toEqual({
      path: 'videoId',
      message: 'videoId is required',
    });
  });

  it('rejects unknown keys instead of silently dropping them', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({ videoId, eventType: 'view', video_id: 3 })
      .expect(422);

    expect(JSON.stringify(response.body.error.details)).toContain('video_id');
  });

  it('returns 404 for a video that does not exist', async () => {
    const response = await request(app)
      .post('/api/events')
      .send({ videoId: 999_999, eventType: 'view' })
      .expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('refuses a future timestamp, which no time window would ever match', async () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    const response = await request(app)
      .post('/api/events')
      .send({ videoId, eventType: 'view', occurredAt: future })
      .expect(422);

    expect(response.body.error.message).toMatch(/future/i);
  });

  it('turns malformed JSON into a 400 rather than a 500', async () => {
    const response = await request(app)
      .post('/api/events')
      .set('Content-Type', 'application/json')
      .send('{"videoId":')
      .expect(400);

    expect(response.body.error.code).toBe('MALFORMED_JSON');
  });

  it('never writes a row that violates the event_type CHECK constraint', () => {
    expect(() =>
      db
        .prepare(`INSERT INTO engagement_events (video_id, event_type) VALUES (?, 'refund')`)
        .run(videoId),
    ).toThrow(/CHECK constraint failed/);
  });
});

describe('unmatched routes', () => {
  it('returns JSON, not Express HTML, for an unknown path', async () => {
    const response = await request(app).get('/api/nope').expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});
