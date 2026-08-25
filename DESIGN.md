# Design system

The visual decisions behind the dashboard, and why each one was made. Tokens
live in `client/src/styles/_tokens.scss`; nothing below is decoration for its
own sake.

## Mode

**Operate.** The merchant is in a task, not being persuaded. Scanability,
consistent affordances and native expectations outrank expression. Personality
lives in precision — alignment, numerals, state handling — not in ornament.

The use scene is a laptop in a lit room during working hours, so **light is the
default theme** and dark is available, not the reverse.

## Color

A single accent hue does all the work. The choice is a deep **jade** rather than
the default indigo/violet of most dashboards: this product measures money moving
through a funnel, and the accent doubles as the funnel's own scale.

The three funnel stages are not three unrelated hues — they are one hue at
increasing depth, so the strip reads as a narrowing progression toward the
valuable action rather than as a chart legend:

| Stage        | Role                             |
| ------------ | -------------------------------- |
| Views        | `--funnel-1` — lightest jade     |
| Clicks       | `--funnel-2` — mid jade          |
| Add to carts | `--funnel-3` — full accent       |

Neutrals are very slightly cool so the jade sits cleanly against them. Three
surface levels — canvas, raised, sunken — carry the panel structure without
shadows doing the work.

Semantic color is reserved: positive/negative appear only on trend deltas, and
**never carry meaning alone** — every delta also states its direction in text
and in an arrow glyph, which is what makes it legible to a red-green colorblind
merchant.

## Typography

One family. Product UI does not need a display/body pairing, and a display face
in a data table is a costume.

The stack is the platform UI font (`-apple-system` / `Segoe UI` / `Roboto`).
This is a deliberate choice, not a fallback: it renders at native quality on
every reviewer's machine, ships zero bytes, and cannot fail to load offline.

- **Fixed rem scale, not fluid.** Users view a dashboard at a consistent DPI. A
  `clamp()`-sized heading that shrinks inside a narrow panel looks worse, not
  responsive.
- **Ratio ≈ 1.15–1.2.** Six type sizes from 11px to 28px. A dashboard has more
  type roles than a landing page; exaggerated contrast between them reads as
  noise.
- **`font-variant-numeric: tabular-nums` on every number.** Proportional digits
  make a column of figures ragged and defeat the point of right-alignment. This
  is the single highest-leverage typographic decision in the whole interface.

## Layout

- 4px spacing grid throughout; every gap is a token, never a magic number.
- Table rows are 52px — dense enough to compare eight at a glance, tall enough
  for a two-line video/product cell.
- Numbers right-aligned, text left-aligned. Non-negotiable in a data table.
- Responsive behavior is **structural**, by progressive column disclosure: at
  900px the derived ratios and the trend drop; at 640px the intermediate funnel
  counts drop too, leaving video, views and conversion rate — which fits a
  phone with no horizontal scrolling. The type scale never changes.

  Columns are dropped rather than restructured into stacked cards on purpose.
  A card restructure needs `display: block` on the table elements, which strips
  the table role out of the accessibility tree and has to be rebuilt by hand
  with ARIA. Dropping columns keeps real header/cell association at every
  width.

## Depth and shape

- Radii stay small (4–10px). Large radii read as consumer-app softness and
  waste horizontal space in a dense table.
- Shadows carry a real offset and a soft blur. No zero-offset colored halos.
- Borders, not shadows, separate structural regions. Shadows are reserved for
  things that genuinely float: the toast and the sticky app bar at scroll.

## Motion

150–250ms, exponential ease-out, from an already-visible default state. No
page-load choreography — the merchant came to read a table, not to watch it
arrive.

There is exactly **one authored moment**: when the traffic simulator records
events, the affected row pulses once in the accent so the merchant can see
*which* row their action changed. Everything else is state feedback.

`prefers-reduced-motion` removes all of it.

## Browser surfaces

The parts not drawn by hand still belong to the design: text selection, the
caret, scrollbars, focus rings and form-control accents are all themed from the
palette in `global.scss`. Left at browser defaults they belong to no design
system, and they are the cheapest tell that a page was assembled rather than
built.

## What was deliberately refused

- **Stat cards.** The obvious summary treatment — four tiles of big-number +
  label + accent — shows four disconnected figures. The funnel strip shows the
  same data as one shape with the drop-off between stages visible, which is the
  actual thing the merchant is trying to judge.
- **Cards as page structure.** One table panel, one funnel strip. Nested cards
  are always wrong.
- **A sidebar with invented navigation.** There is one screen. Dead nav links
  are a lie about the product's size.
- **Emoji as icons.** Every icon is authored SVG on a 16px grid at a uniform
  1.5px stroke, inheriting `currentColor`.
- **A gradient anything.** Emphasis comes from weight, size and position.
