# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 + Vite (TypeScript) on the front end; Node.js/Express + SQLite
(better-sqlite3) on the back end. SCSS Modules over a CSS custom-property token
layer for styling — Tailwind is excluded by the assignment brief, which cites
utility-class maintenance cost in complex dashboards.

## Users

E-commerce merchants running a storefront that embeds shoppable video —
typically the owner or a single marketing operator, not a data team. They open
this a few times a day on a laptop, in a lit room, between other tasks. They
arrive with one question ("which videos are actually selling?") and want it
answered in the first screenful.

## Product Purpose

Videoselz places shoppable video on merchant storefronts. This dashboard is the
merchant's read on whether that video is working: for every published video, how
many people watched it, how many clicked through to the product, and how many
added it to their cart. Success is a merchant deciding what to re-shoot, promote
or retire without exporting anything.

## Positioning

The metric that matters is not a view count — it is the funnel from view to
click to cart, per video. Generic storefront analytics report page-level
conversion and cannot attribute a cart to the clip that caused it. Attribution
at the individual video level is the thing this product knows and a page
analytics tool does not.

## Operating Context

- Events arrive continuously from storefronts as webhook traffic, not on a
  batch schedule; the dashboard reads an append-only event log.
- A merchant's catalogue is small — tens of videos, not thousands. Depth of
  per-video detail matters more than large-scale aggregation.
- Freshly published videos with zero traffic are a normal, frequent state, not
  an error condition.

## Capabilities and Constraints

- Three event types, in funnel order: `view`, `click`, `add_to_cart`.
- Aggregation is scoped to a time window (24h / 7d / 30d / all).
- Conversion rate is defined as add-to-carts ÷ views and is derived in the
  client, per the assignment brief. The API returns raw counts only.
- Pagination is required on the analytics endpoint.
- The traffic simulator writes to the same public ingest endpoint a real
  storefront would use. It is a demo affordance, not a separate code path.
- No authentication, no multi-tenancy: single-merchant scope by assignment.

## Brand Commitments

Name: **Videoselz**. No supplied logo, palette or typeface — the visual system
in DESIGN.md was authored for this build and is documented there.

## Evidence on Hand

- `server/src/db/seed.ts` generates 30 days of deterministic, funnel-shaped
  traffic across 12 products and 15 videos. All catalogue names, prices and
  video URLs are invented for the demo and are obviously non-real
  (`cdn.videoselz.example`). No claim in this repo describes a real customer,
  benchmark or deployment.

## Product Principles

1. **The funnel is the story.** View, click and cart are three stages of one
   thing. Any view that shows them as unrelated numbers is showing less than it
   knows.
2. **Counts are facts; ratios are opinions.** Store and transmit raw counts;
   derive every rate at the edge, where its definition is visible.
3. **Zero is a real answer.** A video with no traffic must render honestly —
   never as `NaN%`, never as a misleading `0%`, never omitted.
4. **Density in service of scanning.** A merchant compares rows. Rows should be
   compact and numerically aligned, not spaced out into cards.
5. **No invented affordance.** Nothing in the UI links anywhere that does not
   exist or reports a number the API did not return.

## Accessibility & Inclusion

Keyboard-operable throughout, `aria-sort` on sortable columns, visible focus
rings on every interactive element, and no meaning carried by color alone —
trend direction is stated in text as well as drawn.
