# Scrub chart + allocation pie — design (2026-11-25)

## Intent

The owner wants the dashboard to feel like Wealthsimple: a big portfolio value
at the top with a line chart under it that you can drag across, day by day,
to see the value and the gain/loss at that point. Plus a pie chart of the
allocation. Overrides two DESIGN.md rules ("no pie chart", "one chart, no
chart above the fold"); DESIGN.md gets updated to match.

## Goals

- Hero at the top: big value, change line (green/red, $ and %), daily line
  chart, range buttons 1M / 3M / All.
- Drag (mouse or touch) or arrow keys across the chart: the big number,
  change line, and date update to the day under the cursor.
- Donut chart of allocation by asset class (ETFs / stocks / cash).

## Non-goals

- No live prices, no real daily data (cut list holds).
- No daily VEQT series; the benchmark panel stays monthly, as built.
- No pie for the 7 individual holdings (too many slices); the by-holding
  table stays.

## Anti-goals

- Monthly figures must not move: totals, the +5.2pp benchmark line, and
  every existing test stay exactly as they are.
- The coach must never cite a generated daily value; it uses only the
  monthly seed figures and holdings.
- Generated data is never presented as real: labelled mock everywhere.

## Approaches

**Daily data** — picked: a script generates the series once into
`data/daily.seed.json` (committed, deterministic seed). Rejected:
generating at runtime (harder to test; coach and page could disagree).

**Charts** — picked: hand-built SVG, same as the benchmark chart (no new
dependency, consistent styling, touch works). Rejected: Recharts (~100 KB,
fights the custom look; not worth it a day before the demo).

**Placement** — picked by the owner: the scrub chart is the hero at the top,
Wealthsimple-style. Rejected: its own panel lower down.

## Decided

- Series: trading days Jun 1 – Nov 25, 2026 (weekdays minus TSX holidays).
  Anchored exactly: Jun 1 = June figure ($17,200.00); last trading day of
  Jul, Aug, Sep, Oct = that month's figure; Nov 25 = $19,182.00. In between:
  seeded random walk bridged to hit each anchor, roughly 0.8% daily moves.
- Tests: every anchor matches `benchmark.seed.json`; last point equals the
  holdings total; no gaps or weekend dates; values positive and in cents.
- Hero shows **change in value** over the range, not "gain": the
  portfolio line includes contributions (same honesty note as the
  benchmark panel). Total gain (+$1,572 / +8.9%) and cash stay just below.
- Change colour: green if up, red if down, grey if flat, on both the text
  and the line.
- Ranges: 1M ≈ last 21 trading days, 3M ≈ last 63, All = from Jun 1.
- Donut: 3 slices, exact $ and % on hover/focus and in the table beside it;
  total in the hole. Colours validated with the dataviz checker; green and
  red stay reserved for gain/loss.
- Text alternative: chart aria-label states range, start, end, and change.

## Left to the builder

Generator's exact volatility and seed; holiday list; donut colours (must
pass validation); tooltip/scrub-line styling within DESIGN.md tokens;
DESIGN.md wording updates.
