# Videoselz — Shoppable Video Analytics Dashboard

A merchant-facing dashboard for tracking how shoppable videos perform on a
storefront: for every published video, how many people watched it, clicked
through to the product, and added it to their cart.

Express + SQLite API, React + TypeScript front end, no Tailwind.

---

## ⚠️ Submission checklist — fill these in before sending

> These four items are required by the assignment brief and cannot be
> generated from the code. Replace each placeholder, then delete this block.

| Item | Link |
| --- | --- |
| **30-second YouTube pitch** (unlisted or private) | `<!-- TODO: paste YouTube URL -->` |
| **3–5 min technical walkthrough** (Loom / screen recording) | `<!-- TODO: paste Loom URL -->` |
| **Other public repositories** — open-source or personal project contributions | `<!-- TODO: paste GitHub/GitLab profile + notable repo URLs -->` |
| **This repository** | `<!-- TODO: paste this repo's public GitHub URL -->` |

---

## Quick start

**Requirements:** Node.js ≥ 20.11 (developed on 22.14) and npm ≥ 10.
Nothing else — the database is a file, and there is no Docker or external
service to run.

```bash
git clone <this-repo-url> && cd Videoselz
npm run setup
npm run dev
```

`npm run setup` installs dependencies for both workspaces, creates the SQLite
schema, and seeds 30 days of demo traffic. `npm run dev` starts both processes
together with colour-coded output.

| | |
| --- | --- |
| Dashboard | **http://localhost:5173** |
| API | **http://localhost:4400** |

The dashboard is the interesting one — open that.

<details>
<summary>Step by step, if you would rather run each part yourself</summary>

```bash
npm install                    # both workspaces (npm workspaces)
npm run db:migrate             # create tables + indexes
npm run db:seed                # 12 products, 15 videos, ~10k events
npm run dev:server             # API on :4400
npm run dev:client             # Vite dev server on :5173
```

</details>

### Every script

| Command | What it does |
| --- | --- |
| `npm run setup` | Install, migrate, seed. Run this first. |
| `npm run dev` | API + dashboard together. |
| `npm run db:reset` | Drop the database and re-seed from scratch. |
| `npm test` | 36 API integration tests (Vitest + Supertest). |
| `npm run typecheck` | Strict TypeScript across both workspaces. |
| `npm run build` | Production build of both. |
| `npm start` | Run the built API. |

### Configuration

Everything has a working default; no `.env` file is needed.

| Variable | Default | Notes |
| --- | --- | --- |
| `API_PORT` | `4400` | Takes precedence over `PORT`, which is ambient in a lot of tooling. |
| `DATABASE_FILE` | `server/data/videoselz.db` | `:memory:` is used by the test suite. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated. |
| `RATE_LIMIT_MAX` | `600` per minute | Applies to `POST /api/events` only. |

> **Port conflict?** If `4400` is taken, run
> `API_PORT=4401 npm run dev:server` and
> `VITE_API_TARGET=http://localhost:4401 npm run dev:client`.

---

## What it does

- **Data table** of every video with views, clicks and add-to-carts, server-side
  sorted, searched and paginated.
- **Conversion rate** (add-to-carts ÷ views) and CTR, both derived in the
  browser from the raw counts the API returns.
- **Simulate traffic** posts a realistic session to the live ingest endpoint and
  refreshes the table, pulsing the row it changed.
- **Engagement funnel** summarising the selected window, with the drop-off
  between each stage.
- **Reporting window** — 24h / 7d / 30d / all-time.
- Light and dark themes, keyboard-operable throughout, responsive to 375px.

---

## Architecture

```
videoselz-analytics/
├── shared/api.ts          # The HTTP contract. Imported by both sides.
├── server/
│   └── src/
│       ├── app.ts         # Express factory over an injected db handle
│       ├── config.ts
│       ├── db/            # schema.sql, connection, migrate, seed
│       ├── middleware/    # validation, errors, rate limit, logging
│       ├── lib/           # ApiError, asyncHandler, logger
│       └── modules/
│           ├── events/    # routes → service → repository → validation
│           ├── analytics/
│           └── videos/
└── client/
    └── src/
        ├── styles/        # _tokens.scss, _mixins.scss, global.scss
        ├── components/    # Button, SearchInput, SegmentedControl, Icon, …
        ├── features/analytics/
        ├── hooks/
        └── lib/           # api client, formatters
```

**One shared contract.** `shared/api.ts` is the single source of truth for every
payload crossing the network. Both workspaces consume it, so changing a response
shape on the server surfaces as a compile error in the client rather than as
`undefined` in a table cell.

**Routes → service → repository.** Routes handle HTTP, services own business
rules and pagination arithmetic, repositories own SQL. `createApp(db)` is a
factory over an injected database handle, which is what lets the test suite
exercise real routing, real middleware and real SQL against an in-memory
database — no mocks anywhere.

---

## Database

Three tables in third normal form.

```
products ──1:N──> videos ──1:N──> engagement_events
```

| Table | Columns |
| --- | --- |
| `products` | `id`, `name`, `price_cents`, `currency`, `created_at` |
| `videos` | `id`, `product_id` → products, `title`, `video_url`, `created_at` |
| `engagement_events` | `id`, `video_id` → videos, `event_type`, `occurred_at` |

Design decisions worth defending:

- **Money is stored in minor units as `INTEGER`.** SQLite's `REAL` is an
  IEEE-754 double; `19.99` has no exact binary representation and summing such
  values drifts. Cents keeps the arithmetic exact.
- **No metric is denormalised onto `videos`.** Every count in the dashboard is
  derived from the append-only event log, so there is no cached counter that can
  drift out of sync with the events that produced it.
- **`event_type` is `CHECK`-constrained in the database** as well as in the
  request validator, because the API is not the only writer — seeds, manual SQL
  and any future importer go through the same guarantee.
- **`foreign_keys` is enabled per connection.** SQLite ships with it *off* for
  backwards compatibility; without the pragma a `video_id` could reference a row
  that does not exist.
- **Composite index `(video_id, occurred_at, event_type)`** serves both the
  per-video rollup and the windowed daily trend from a single index.

---

## API

Every response is JSON. Every non-2xx uses the same envelope:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "…", "details": [ … ] } }
```

### `POST /api/events`

Ingests one engagement event — modelled on a storefront webhook:
unauthenticated, rate-limited, and strict about its payload.

```bash
curl -X POST http://localhost:4400/api/events \
  -H 'Content-Type: application/json' \
  -d '{"videoId": 5, "eventType": "add_to_cart"}'
```

```json
{ "data": { "id": 9914, "videoId": 5, "eventType": "add_to_cart",
            "occurredAt": "2026-08-25T17:25:09.965Z" } }
```

| Field | Required | Notes |
| --- | --- | --- |
| `videoId` | yes | Must reference an existing video, else `404`. |
| `eventType` | yes | `view` \| `click` \| `add_to_cart`. |
| `occurredAt` | no | ISO-8601. Defaults to now; normalised to UTC. |

| Status | When |
| --- | --- |
| `201` | Created. |
| `400` | Body is not valid JSON. |
| `404` | No such video. |
| `422` | Failed validation, including unknown keys and future timestamps. |
| `429` | Rate limit exceeded. |

Unknown keys are rejected rather than dropped: a caller who typos `video_id`
gets a `422` naming the field instead of a `201` that recorded nothing useful.

### `GET /api/analytics/videos`

Videos with aggregated metrics for the selected window, paginated.

```bash
curl 'http://localhost:4400/api/analytics/videos?page=1&pageSize=10&sort=views&order=desc&period=7d'
```

| Parameter | Default | Values |
| --- | --- | --- |
| `page` | `1` | ≥ 1. Past the last page clamps to the last page. |
| `pageSize` | `10` | 1–100. Above the ceiling is a `400`. |
| `sort` | `views` | `title`, `views`, `clicks`, `addToCarts`, `clickThroughRate`, `conversionRate`, `lastEventAt` |
| `order` | `desc` | `asc` \| `desc` |
| `period` | `7d` | `24h`, `7d`, `30d`, `all` |
| `search` | — | Matches video title or product name. |

```jsonc
{
  "data": [{
    "videoId": 5, "title": "Why the spout angle matters",
    "videoUrl": "https://cdn.videoselz.example/v1/clips/aster-spout-angle.mp4",
    "product": { "id": 3, "name": "Aster Ceramic Pour-Over",
                 "priceCents": 6400, "currency": "USD" },
    "views": 235, "clicks": 72, "addToCarts": 34,
    "lastEventAt": "2026-08-25T17:17:31.948Z",
    "trend": [38, 25, 40, 32, 24, 45, 14]   // daily views, zero-filled
  }],
  "pagination": { "page": 1, "pageSize": 10, "totalItems": 15,
                  "totalPages": 2, "hasNextPage": true, "hasPreviousPage": false },
  "totals":     { "videos": 15, "views": 2413, "clicks": 622, "addToCarts": 271 },
  "meta":       { "period": "7d", "since": "2026-08-18T17:25:09.932Z",
                  "sort": "views", "order": "desc", "search": null }
}
```

**No `conversionRate` field, deliberately.** The brief specifies it as a
client-side calculation, and returning raw counts keeps the endpoint useful to
callers that want a different ratio. It *is* sortable, because sorting only the
current page would give a different answer on every page.

`totals` describes the whole window rather than the current page, so paging does
not move the funnel strip.

### `GET /api/videos` · `GET /api/health`

An id/title list used by the traffic simulator, and a health probe the
dashboard header polls to tell you whether the API is reachable.

---

## The aggregation query

The one piece of SQL worth reading. It pre-rolls the event log in a CTE
*before* joining:

```sql
WITH event_stats AS (
  SELECT video_id,
         SUM(event_type = 'view')        AS views,
         SUM(event_type = 'click')       AS clicks,
         SUM(event_type = 'add_to_cart') AS add_to_carts,
         MAX(occurred_at)                AS last_event_at
  FROM engagement_events
  WHERE occurred_at >= @since
  GROUP BY video_id
)
SELECT v.id, v.title, p.name,
       COALESCE(s.views, 0)  AS views, …
FROM videos v
INNER JOIN products p ON p.id = v.product_id
LEFT  JOIN event_stats s ON s.video_id = v.id
ORDER BY views DESC NULLS LAST, v.id ASC
LIMIT @limit OFFSET @offset
```

- **Why a CTE and not a direct `LEFT JOIN` + `GROUP BY`?** The naive form fans a
  15-row video table out to one row per event — tens of thousands — and only
  then collapses it. And once a `GROUP BY` sits in the outer query, reasoning
  about what `LIMIT` applies to gets subtle. The CTE keeps the outer query at
  exactly one row per video, so `LIMIT`/`OFFSET` paginate *videos*.
- **`SUM(event_type = 'view')`** is SQLite's conditional-count idiom: the
  comparison yields 1 or 0. It reads better than three correlated subqueries and
  touches the index once.
- **`LEFT JOIN`, not `INNER`.** A video with no events in the window is still a
  video the merchant published and needs to see.
- **`ORDER BY` is an allow-list, not interpolation.** `ORDER BY` cannot be
  parameterised — a bound value there is a constant, not an identifier — so sort
  keys map through a frozen `Record<SortField, string>`. Anything else is a
  `400`, and there is a test asserting the table still exists afterwards.
- **`NULLS LAST` in both directions.** SQLite sorts `NULL` below everything, so
  an ascending sort would float "no activity yet" rows to the top.
- **Trend series are one grouped query per page**, not one per row. Per-row
  fetching would be a textbook N+1.

---

## Front end

**No Tailwind**, per the brief. Styling is CSS custom properties for the token
layer plus per-component `*.module.scss`. Tokens and mixins are injected into
every module by Vite, which makes a raw hex value inside a component stand out
as the exception it is.

The visual system, and what was deliberately *refused*, is documented in
[DESIGN.md](DESIGN.md). Two decisions that shaped the screen:

- **The summary is a funnel, not four stat cards.** Four tiles show four
  disconnected numbers. The funnel strip shows the same data as one shape, with
  the drop-off between stages visible — which is the judgement a merchant is
  actually making.
- **Zero is rendered honestly.** A video with no views has an *unknown*
  conversion rate, not a 0% one. It shows an em dash. The seed data includes a
  deliberately traffic-free video so this path is always on screen.

### Edge cases handled

| Case | Behaviour |
| --- | --- |
| Video with 0 views | `—`, never `NaN%` or a misleading `0%` |
| Paging past the last page | Clamps to the last page, not an empty table |
| Search with no matches | Distinct empty state, with a way back |
| Search containing `%` or `_` | Escaped and matched literally |
| API unreachable | Named error, retry button, header status turns red |
| Slow response overtaken by a newer one | Superseded requests aborted and ignored |
| Refetch after simulating | Table keeps its rows; a quiet "Updating" appears |
| `prefers-reduced-motion` | All motion removed |

---

## Testing

```bash
npm test
```

36 integration tests via Supertest against `createApp()` with an in-memory
database — no mocks, so each test exercises middleware order, validation, SQL
and serialisation together.

They cover the parts most likely to be wrong: the funnel invariant
(clicks ≤ views), the zero-traffic video, totals staying stable across pages,
page clamping, window boundaries, sort-allow-list rejection, and literal `LIKE`
wildcards.

---

## Things I would do next

Out of scope at this size, but the honest list:

- **Auth and multi-tenancy.** Every query would take a `merchant_id`, and the
  ingest endpoint would need a signed webhook secret rather than a rate limit.
- **The rate limiter is per-process.** Across N instances it would allow N × the
  limit; it belongs in Redis.
- **Cursor pagination.** `OFFSET` degrades on large tables, and a row inserted
  mid-page shifts everything. Keyset pagination on `(sort_value, id)` fixes both.
- **Pre-aggregated rollups.** Counting the raw event log is right at this size,
  but past millions of rows a daily `video_id × event_type` rollup table would
  keep the dashboard fast.
- **Front-end tests.** The API is covered; the React layer is not. Testing
  Library over the table, the simulator and the empty states is the gap I would
  close first.
- **Idempotency keys** on `POST /api/events`, so a webhook retry cannot
  double-count a conversion.

---

## AI usage

Per the brief, [AI_PROMPTING.md](AI_PROMPTING.md) logs the real prompts,
context and outcomes from building this.
