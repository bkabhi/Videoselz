# AI Collaboration Log

Required by section 4 of the assignment brief.

**A note on shape.** This project was built in a single agentic session rather
than through a long back-and-forth of individual prompts. I gave one detailed
opening instruction, answered two rounds of clarifying questions, and the
assistant then planned and executed. So there are three verbatim prompts from
me, not thirty — and inflating that into a fake prompt-per-feature log would
misrepresent how the work actually happened.

What that makes valuable is the **Outcome & Adjustments** sections. Every entry
below records what the AI produced and, specifically, **what was wrong with it
and how it was corrected**. Several of these were bugs that typechecked cleanly
and passed tests, and were only caught by actually running the thing.

**Tool used throughout:** Claude Opus 5, via the Claude Code CLI, with browser
automation for visual verification and a design-review skill (`impeccable`)
loaded for the UI work.

---

## 1 — Opening instruction: requirements, then plan, then build

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Kicking the project off from the assignment PDF, with an
explicit quality bar for the interface.

**Exact prompt:**

```
implement this @Candidate Assignment_ Full Stack Developer Project.pdf
and in this project ui must not look like vibe coded or ai slop
it must be professional ui ux

first check all requirement of this project in this pdf file
and then plan and then build
you can ask me questions if needed

all requirements and guideline are mentioned in this pdf @Candidate Assignment_
Full Stack Developer Project.pdf so first check this pdf and then start
```

**Outcome & Adjustments:**

- The PDF could not be read directly — no `poppler` on the machine and no PDF
  library installed. It installed `pypdf` and extracted both pages, then
  restated the requirements back to me as a table before writing any code. I
  wanted the requirements confirmed before implementation, and that is what the
  "first check the pdf, then plan, then build" instruction was for.
- It correctly identified the two constraints that are easy to miss: **no
  Tailwind**, and **conversion rate must be calculated on the frontend**.
- Rather than starting to code, it asked clarifying questions first (entry 2).
  That was the right call and matched the instruction.

---

## 2 — Clarifying rounds before implementation

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Resolving the decisions that would materially change the
build, before any code existed.

**Exact prompts (my answers to its two question rounds):**

Round 1:
```
Language:  TypeScript
Styling:   SCSS Modules + design tokens
Scope:     Spec + considered polish
Git:       Yes, init + commit locally
```

Round 2:
```
AI log:        Log this real session
README links:  Clear TODO placeholders
Use scene:     Daytime desk, glance-and-act
```

**Outcome & Adjustments:**

- The "use scene" answer directly drove two decisions I would not have thought
  to specify: **light theme as the default** (a merchant at a lit desk, not a
  developer at night) and medium-dense rows tuned for scanning rather than
  maximum density.
- It flagged something from its design review process that changed the design:
  the obvious summary treatment — four stat cards of big-number-plus-label — is
  a known generic pattern. It proposed a **funnel strip** instead, showing
  views → clicks → add-to-carts as one shape with the drop-off between stages.
  I agreed. This is the single biggest reason the dashboard does not look
  like a template, and it came out of the AI arguing against its own default.

---

## 3 — Database schema and the aggregation query

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Normalised SQLite schema plus the `GET /api/analytics/videos`
aggregation — the core technical problem in the brief.

**Exact prompt:** *(no separate prompt — executed from the instruction in
entry 1, under the decisions from entry 2)*

**Outcome & Adjustments:**

- **The aggregation was written correctly first time**, and notably did *not*
  make the mistake the brief's own example warns about. It pre-aggregates the
  event log in a CTE before joining, rather than `LEFT JOIN`-ing
  `engagement_events` directly and grouping afterwards. I checked this
  specifically: the naive form fans the video table out to one row per event
  before collapsing it, and puts a `GROUP BY` in the outer query, which makes
  `LIMIT` semantics subtle. The CTE keeps the outer query at one row per video.
- **Dead code I made it remove.** Its first draft contained
  `const nullsLast = options.direction === 'desc' ? '' : '';` — a ternary with
  identical branches, interpolated into the `ORDER BY`. It was a placeholder
  that got left in. Replaced with a real `NULLS LAST` on both directions, so
  zero-activity rows sink instead of floating to the top of an ascending sort.
- **`ORDER BY` allow-list.** It correctly identified that `ORDER BY` cannot be
  parameterised and mapped sort keys through a frozen record. I asked for a test
  that asserts the table still exists after an injection attempt, not just that
  the request 400s — the weaker test would pass even if the query had run.
- **Money as cents** was its suggestion, with the right justification (SQLite
  `REAL` is an IEEE-754 double). I kept it.

---

## 4 — Event ingestion endpoint

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** `POST /api/events`, modelled as storefront webhook traffic.

**Exact prompt:** *(executed from entry 1)*

**Outcome & Adjustments:**

- **Bug caught by running it, not by the types.** The Zod schema for the
  analytics query used
  `.optional().transform(v => v ? v : null).default(null)`. This typechecks,
  but Zod feeds a `.default()` value back *through* the inner schema — and
  `null` is not a string. Every request to `/api/analytics/videos` returned
  `400 "Expected string, received null"`. Only surfaced by curling the endpoint.
  Fixed by dropping `.default()` and letting the transform handle the absent
  case, which it already did.
- **Error message quality.** `z.coerce.number()` on a missing `videoId` runs
  `Number(undefined)` and reports `"Expected number, received nan"` — which
  tells a webhook author nothing. Replaced with a `z.preprocess` that only
  coerces strings, so a missing field reports `"videoId is required"` and a
  malformed one reports that it is malformed.
- **Future timestamps.** I raised that an event dated in the future silently
  vanishes from every time-windowed query. It added an explicit rejection with
  a clock-skew tolerance rather than accepting a row nobody would ever see.

---

## 5 — Frontend: design system and dashboard

**Tool:** Claude Opus 5 (Claude Code CLI), with the `impeccable` design skill

**Context/Task:** Building the dashboard to the "not AI slop" bar from entry 1.

**Exact prompt:** *(executed from entry 1; the quality bar in that prompt is
what drove this phase)*

**Outcome & Adjustments:**

- **What the design constraints ruled out**, and I agreed with all of them:
  stat cards as page structure, a sidebar of invented navigation links, emoji
  standing in for icons, gradient text. Icons are authored SVG on one 16px grid
  at a uniform 1.5px stroke.
- **Accent colour.** Its first instinct was the default dashboard indigo. I
  pushed for something that was not the AI-default blue/purple; it landed on a
  deep jade with an argument I accepted — this product measures money through a
  funnel, so the accent can double as the funnel's own scale (one hue at three
  depths).
- **Layout bug found by looking at it.** The Video column's content was centred
  rather than left-aligned, visibly off-axis from its own header. Cause: the
  cell is a `<th scope="row">` for accessibility, and the browser's default
  stylesheet centres and bolds `th`. Neither the types nor the tests could catch
  this. Fixed with an explicit `text-align: left` and weight reset.
- **`Button` prop-order bug.** It wrote
  `onClick={isLoading ? undefined : props.onClick}` *before* `{...props}`, so
  the spread reinstated the caller's handler and the loading guard did nothing.
  Reordered so the override wins.
- **A data bug in the funnel.** With zero results, the Views row printed
  `100%` — a share of nothing. Same class of mistake as rendering 0/0 as 0%.
  Now shows an em dash.

---

## 6 — Accessibility corrections

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Auditing the rendered accessibility tree in a real browser.

**Exact prompt:** *(executed from entry 1)*

**Outcome & Adjustments:**

- **Two WCAG 2.5.3 "Label in Name" failures**, found by reading the live
  accessibility tree rather than the source. The period buttons showed `24h`
  but were *named* "Last 24 hours", and the `CTR` column header was named by
  its `title` attribute — so a voice-control user saying "click CTR" or
  "click 24h" would hit nothing. Fixed so the visible label stays inside the
  accessible name and the expansion is appended to it.
- It had already got several things right unprompted: `aria-sort` on the header
  cell rather than the button, `aria-disabled` instead of `disabled` on a
  loading button (so focus is not thrown to the body mid-interaction), and real
  radio inputs for the segmented control instead of a row of buttons needing
  hand-rolled arrow-key handling.

---

## 7 — Responsive behaviour

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Checking the dashboard at 375px.

**Exact prompt:** *(executed from entry 1)*

**Outcome & Adjustments:**

- **The design doc promised something the code did not do.** `DESIGN.md` said
  rows restructure into a labelled stack below 640px; only column-dropping was
  actually implemented. I made it either build the promise or correct the
  document — a doc that lies about the code is worse than either.
- We chose **progressive column disclosure** over a card restructure, and
  updated the doc to say so with the reason: a card layout needs
  `display: block` on the table elements, which strips the table role out of
  the accessibility tree and has to be rebuilt by hand with ARIA.
- **Horizontal overflow at 375px.** Even after dropping columns the table
  overflowed, because `table-layout: auto` sizes columns from max-content and
  the product/price line under each title never wraps. Fixed with
  `table-layout: fixed` and explicit column shares at that breakpoint; verified
  in the browser that `scrollWidth === clientWidth`.

---

## 8 — Performance: animation of layout properties

**Tool:** Claude Opus 5 (Claude Code CLI) + mechanical design detector

**Context/Task:** Running an automated check over the finished CSS.

**Exact prompt:** *(executed from entry 1)*

**Outcome & Adjustments:**

- The detector flagged two `transition: width` rules — animating width re-runs
  layout on every frame.
- The AI's first fix was `transform: scaleX()`, which is composited but
  horizontally squashes the rounded caps on an 8px-tall pill. I rejected it as
  a visible regression.
- Settled on `clip-path: inset(… round …)`, which composites like a transform
  *and* carries its own corner radius, so the caps stay circular at every
  width. The conversion micro-bars simply lost their transition — ten 3px bars
  animating on every refetch is layout work spent on movement nobody watches.
- Detector re-run: clean.

---

## 9 — Production build: three bugs that only appear after `npm run build`

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Verifying `npm run build && npm start`, not just `npm run dev`.

**Exact prompt:** *(executed from entry 1)*

**Outcome & Adjustments:**

This is the entry I would most want to be asked about. All three bugs
typechecked cleanly and passed all 36 tests, and would have shipped if the
built output had never been executed.

1. **`ERR_MODULE_NOT_FOUND` on the shared contract.** The server imported
   `@shared/api` through a `tsconfig` path alias. TypeScript resolves `paths`
   for *type-checking only* — it does not rewrite the emitted import specifier.
   The two runtime value imports (the Zod enum sources) survived compilation
   verbatim and threw under plain `node`. The type-only imports were fine
   because they are erased, which is exactly why this hid so well. Fixed by
   importing the contract relatively on the server and deleting the alias from
   `tsconfig` and `vitest.config` so it cannot come back. The client keeps its
   alias, because Vite genuinely rewrites it at build time.
2. **`schema.sql` never reached `dist`.** `tsc` emits TypeScript and ignores
   every other asset. Added an explicit copy step to the build.
3. **The worst one, because it fails silently.** `serverRoot` was
   `path.resolve(here, '..')`, correct from source but resolving to
   `dist/server` from the build — so `npm start` opened a *second, empty*
   database. No error: the API booted, returned `200`, and showed an empty
   dashboard. Now anchored on the nearest `package.json`, which is the server
   workspace in both modes.

Separately: the API had been binding to Vite's port, because `config.ts` read
the ambient `PORT` variable, which the surrounding tooling sets. Renamed to
`API_PORT` with a `PORT` fallback so deployment still works.

---

## 10 — Test suite

**Tool:** Claude Opus 5 (Claude Code CLI)

**Context/Task:** Integration tests over the API.

**Exact prompt:** *(executed from entry 1)*

**Outcome & Adjustments:**

- 36 tests, Supertest against `createApp()` with an in-memory database. No
  mocks, so each test runs real middleware ordering, real validation and real
  SQL.
- **A time bomb I made it fix.** The fixture was anchored to a hardcoded date,
  `new Date('2026-08-20T12:00:00Z')`, while the period filters resolve their
  window from `Date.now()`. The `24h` test failed immediately (the fixture was
  already five days stale) — and had the date been chosen a day later it would
  have passed and then started failing silently weeks afterwards. Anchored to
  the real clock.
- I asked for tests that assert *consequences*, not just status codes: the
  injection test checks the table still exists; the create-event test checks the
  row count actually increased rather than trusting the `201`.

---

## Summary: where the AI helped, and where it needed correcting

**Strong without intervention:** the SQL aggregation strategy, the layered
module structure, Zod validation design, error-envelope consistency, the
accessibility fundamentals (`aria-sort` placement, `aria-disabled` on a loading
button, real radio inputs), and the seeded-PRNG deterministic data generator.

**Needed correcting:** it does not check its own runtime behaviour unless made
to. Every one of the highest-severity bugs — the Zod `.default()` failure, all
three production-build failures, the centred `th`, the `100%`-of-nothing —
passed typechecking and, in most cases, passed the test suite. They were found
by curling endpoints, running the built output, and looking at rendered pixels
and the live accessibility tree.

**The lesson I would take to a team:** AI-generated code should be reviewed
against *what it does when executed*, not against how plausible it reads.
Plausibility is precisely the thing these tools optimise for, and it is what
made three silent production failures survive a clean typecheck and 36 passing
tests.
