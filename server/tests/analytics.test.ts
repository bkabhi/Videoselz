import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import type { Db } from '../src/db/client.js';
import type { VideoAnalyticsResponse } from '@shared/api';
import { createTestDb, seedFixture } from './helpers.js';

let db: Db;
let app: Express;
let alpha: number;
let beta: number;
let quiet: number;

beforeAll(() => {
  db = createTestDb();
  const fixture = seedFixture(db);
  [alpha, beta, quiet] = fixture.videoIds as [number, number, number];
  app = createApp(db);
});

afterAll(() => db?.close());

const get = async (query = ''): Promise<VideoAnalyticsResponse> => {
  const response = await request(app).get(`/api/analytics/videos${query}`).expect(200);
  return response.body as VideoAnalyticsResponse;
};

describe('GET /api/analytics/videos — aggregation', () => {
  it('counts each event type independently without fanning out the join', async () => {
    const body = await get('?period=all&pageSize=100');
    const row = body.data.find((entry) => entry.videoId === alpha);

    // Hand-counted in the fixture: 7 views + 1 older view, 3 clicks, 2 carts.
    expect(row).toMatchObject({ views: 8, clicks: 3, addToCarts: 2 });
  });

  it('returns zeroes, not nulls, for a video with no events', async () => {
    const body = await get('?period=all&pageSize=100');
    const row = body.data.find((entry) => entry.videoId === quiet);

    expect(row).toMatchObject({ views: 0, clicks: 0, addToCarts: 0, lastEventAt: null });
    // The row must still be present — a LEFT JOIN regression would drop it.
    expect(row).toBeDefined();
  });

  it('reports the most recent event timestamp per video', async () => {
    const body = await get('?period=all&pageSize=100');
    const row = body.data.find((entry) => entry.videoId === beta);
    expect(row?.lastEventAt).toBeTruthy();
  });

  it('never reports more clicks than views (funnel invariant)', async () => {
    const body = await get('?period=all&pageSize=100');
    for (const row of body.data) {
      expect(row.clicks).toBeLessThanOrEqual(row.views);
      expect(row.addToCarts).toBeLessThanOrEqual(row.views);
    }
  });

  it('does not return a conversion rate — the client derives it', async () => {
    const body = await get('?period=all');
    expect(body.data[0]).not.toHaveProperty('conversionRate');
  });
});

describe('GET /api/analytics/videos — windowing', () => {
  it('excludes events older than the requested period', async () => {
    const all = await get('?period=all&pageSize=100');
    const day = await get('?period=24h&pageSize=100');

    const allAlpha = all.data.find((r) => r.videoId === alpha);
    const dayAlpha = day.data.find((r) => r.videoId === alpha);

    // The fixture's extra view is 3 days old: inside `all`, outside `24h`.
    expect(allAlpha?.views).toBe(8);
    expect(dayAlpha?.views).toBe(7);
  });

  it('reports the resolved window boundary in meta', async () => {
    const body = await get('?period=7d');
    expect(body.meta.period).toBe('7d');
    expect(Date.parse(body.meta.since as string)).toBeLessThan(Date.now());

    const unbounded = await get('?period=all');
    expect(unbounded.meta.since).toBeNull();
  });
});

describe('GET /api/analytics/videos — totals', () => {
  it('describes the whole window, not the current page', async () => {
    const pageOne = await get('?period=all&pageSize=1&page=1');
    const pageTwo = await get('?period=all&pageSize=1&page=2');

    expect(pageOne.totals).toEqual(pageTwo.totals);
    // 8 + 4 views across the fixture.
    expect(pageOne.totals.views).toBe(12);
    expect(pageOne.totals.clicks).toBe(4);
    expect(pageOne.totals.addToCarts).toBe(2);
    expect(pageOne.totals.videos).toBe(3);
  });
});

describe('GET /api/analytics/videos — pagination', () => {
  it('returns complete, self-consistent pagination metadata', async () => {
    const body = await get('?period=all&pageSize=2&page=1');

    expect(body.pagination).toEqual({
      page: 1,
      pageSize: 2,
      totalItems: 3,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
    expect(body.data).toHaveLength(2);
  });

  it('does not repeat a row across pages', async () => {
    const first = await get('?period=all&pageSize=2&page=1&sort=views&order=desc');
    const second = await get('?period=all&pageSize=2&page=2&sort=views&order=desc');

    const ids = [...first.data, ...second.data].map((r) => r.videoId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(3);
  });

  it('clamps a page beyond the end to the last page instead of returning empty', async () => {
    const body = await get('?period=all&pageSize=2&page=99');
    expect(body.pagination.page).toBe(2);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('rejects a page size above the ceiling', async () => {
    await request(app).get('/api/analytics/videos?pageSize=10000').expect(400);
  });

  it('rejects a non-positive page', async () => {
    await request(app).get('/api/analytics/videos?page=0').expect(400);
    await request(app).get('/api/analytics/videos?page=-4').expect(400);
  });
});

describe('GET /api/analytics/videos — sorting', () => {
  it('orders by the requested metric', async () => {
    const body = await get('?period=all&pageSize=100&sort=views&order=asc');
    const views = body.data.map((r) => r.views);
    expect(views).toEqual([...views].sort((a, b) => a - b));
  });

  it('sinks zero-view rows to the bottom when sorting by conversion rate', async () => {
    const body = await get('?period=all&pageSize=100&sort=conversionRate&order=desc');
    expect(body.data.at(-1)?.videoId).toBe(quiet);
    expect(body.data[0]?.videoId).toBe(alpha);
  });

  it('rejects a sort field outside the allow-list', async () => {
    const response = await request(app)
      .get('/api/analytics/videos?sort=views;DROP%20TABLE%20videos')
      .expect(400);

    expect(response.body.error.code).toBe('BAD_REQUEST');
    // And the table is still there.
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM videos').get() as { n: number };
    expect(n).toBe(3);
  });

  it('rejects an unknown sort direction', async () => {
    await request(app).get('/api/analytics/videos?order=sideways').expect(400);
  });
});

describe('GET /api/analytics/videos — search', () => {
  it('matches on video title, case-insensitively', async () => {
    const body = await get('?period=all&search=ALPHA');
    expect(body.data).toHaveLength(1);
    expect(body.data[0]?.videoId).toBe(alpha);
  });

  it('matches on product name', async () => {
    const body = await get('?period=all&search=Aster');
    expect(body.pagination.totalItems).toBe(3);
  });

  it('scopes the totals to the search, not the whole catalogue', async () => {
    const body = await get('?period=all&search=Alpha');
    expect(body.totals.videos).toBe(1);
    expect(body.totals.views).toBe(8);
  });

  it('treats LIKE wildcards as literal characters', async () => {
    // Un-escaped, "%" would match every row.
    const body = await get('?period=all&search=%25');
    expect(body.data).toHaveLength(0);
  });
});

describe('GET /api/analytics/videos — trend series', () => {
  it('returns one zero-filled bucket per day of the window', async () => {
    const body = await get('?period=7d&pageSize=100');
    for (const row of body.data) {
      expect(row.trend).toHaveLength(7);
      expect(row.trend.every((value) => Number.isInteger(value) && value >= 0)).toBe(true);
    }
  });

  it('sums to the view count within the trend window', async () => {
    const body = await get('?period=24h&pageSize=100');
    const row = body.data.find((r) => r.videoId === alpha);
    const summed = row?.trend.reduce((total, value) => total + value, 0);
    expect(summed).toBe(row?.views);
  });
});

describe('GET /api/health', () => {
  it('reports database connectivity and row counts', async () => {
    const response = await request(app).get('/api/health').expect(200);
    expect(response.body).toMatchObject({ status: 'ok', database: 'connected' });
    expect(response.body.counts.videos).toBe(3);
  });
});
