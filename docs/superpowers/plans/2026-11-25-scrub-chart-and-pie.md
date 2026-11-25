# Scrub Chart + Allocation Pie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Wealthsimple-style hero (big value + draggable daily line chart with 1M/3M/All) at the top of the dashboard, and a donut of allocation by asset class.

**Architecture:** A one-off script writes `data/daily.seed.json` (trading days, anchored to the monthly seed). Pure functions in `lib/daily.ts` slice ranges, compute the readout for a scrub position, and clamp keyboard moves; `lib/donut.ts` computes arcs. Two hand-built SVG client components render them; the server view model passes data in.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, Vitest (`renderToStaticMarkup` for render tests, no jsdom).

**Spec:** `docs/superpowers/specs/2026-11-25-scrub-chart-and-pie-design.md`

## Global Constraints

- Monthly figures never move: all 72 existing tests stay green unchanged.
- Money is integer CAD cents; display via `lib/format.ts` (2 dp money, 1 dp %, U+2212 minus).
- Hero says "change in value", never "gain"; total gain (+$1,572.00 / +8.9%) stays visible below it.
- Green `#15803d` / red `#b91c1c` only for up/down; flat is Pebble `#686664`.
- Every generated value is labelled mock; the coach never reads `daily.seed.json`.
- No new runtime dependencies.

## Review Focus

1. Dragging or arrowing past either end of the chart → clamps to first/last day, never undefined. (Task 2 `nextIndex`, `indexAtX` tests)
2. Switching range while scrubbed → readout returns to the new range's last day. (Task 2 `heroReadout(points, null)` test; Task 4 resets state)
3. A range that ends down or flat → red / grey text and line. (Task 2 tone tests)
4. Only one asset class (e.g. 100% ETFs) → donut draws a full ring, not an empty arc. (Task 3 test)
5. Empty portfolio → no hero, no donut; existing empty state renders. (Task 5 test)

---

### Task 1: Daily series data

**Files:**
- Create: `scripts/generate-daily.mjs`, `data/daily.seed.json`
- Modify: `lib/types.ts` (add `DailyPoint`)
- Test: `tests/daily-seed.test.ts`

**Interfaces:**
- Produces: `interface DailyPoint { date: string /* YYYY-MM-DD */; valueCents: number }`; `data/daily.seed.json: DailyPoint[]`

- [ ] **Step 1: Write the failing test** — `tests/daily-seed.test.ts`:
  - `"has 124 trading days, Jun 1 to Nov 25, no weekends or TSX holidays"`: length 124; first date `2026-06-01`, last `2026-11-25`; no Sat/Sun; none of `2026-07-01, 2026-08-03, 2026-09-07, 2026-10-12`; dates strictly increasing.
  - `"hits every monthly anchor exactly"`: `2026-06-01`→1720000, `2026-07-31`→1785000, `2026-08-31`→1750000, `2026-09-30`→1840000, `2026-10-30`→1890000, `2026-11-25`→1918200 (read the values from `benchmark.seed.json`, not literals).
  - `"last day equals the holdings total"`: last `valueCents === portfolioValueCents(holdings)`.
  - `"values are positive integer cents and daily moves stay under 4%"`.
- [ ] **Step 2: Run** `npx vitest run tests/daily-seed.test.ts` — expected FAIL (file not found).
- [ ] **Step 3: Write `scripts/generate-daily.mjs`** (Node, no deps): builds the trading-day calendar above; seeded mulberry32 (seed `20261125`); per segment between anchors, a Brownian bridge in log space so endpoints are exact:

```js
// segment from anchor a (index i0) to b (index i1), n = i1 - i0
// W_k = sum of n gaussian steps * 0.008; bridge_k = W_k - (k/n) * W_n
// value_k = round(exp(lerp(ln a, ln b, k/n) + bridge_k))
```
  Writes `data/daily.seed.json` (compact, one array). Add `"generate:daily": "node scripts/generate-daily.mjs"` to package.json scripts.
- [ ] **Step 4: Run** `npm run generate:daily` then `npx vitest run tests/daily-seed.test.ts` — expected PASS.
- [ ] **Step 5: Commit** — `feat: add generated daily mock series anchored to monthly seed`

### Task 2: Range, readout, and scrub math

**Files:**
- Create: `lib/daily.ts`
- Modify: `lib/format.ts` (add `formatDay`)
- Test: `tests/daily.test.ts`, `tests/format.test.ts`

**Interfaces:**
- Consumes: `DailyPoint`
- Produces:
  - `type Range = "1M" | "3M" | "All"`; `RANGE_DAYS = { "1M": 21, "3M": 63 }`
  - `sliceRange(series: DailyPoint[], range: Range): DailyPoint[]` — last N points (All = all; N > length → all)
  - `heroReadout(points: DailyPoint[], index: number | null): { value: string; change: string; changePct: string; tone: Tone; date: string; startDate: string }` — index null = last point; change is point vs `points[0]`
  - `nextIndex(current: number | null, key: string, length: number): number | null` — ArrowLeft/Right ±1, Home 0, End length−1, clamped; null current starts from length−1; other keys return current
  - `indexAtX(x: number, width: number, length: number): number` — nearest point, clamped
  - `formatDay(iso: string): string` — `"2026-08-14"` → `"Aug 14, 2026"`

- [ ] **Step 1: Write the failing tests:**
  - `sliceRange(seed, "1M")` length 21 ending `2026-11-25`; `"3M"` length 63; `"All"` length 124; `sliceRange(seed.slice(0, 10), "3M")` length 10.
  - `heroReadout(sliceRange(seed,"All"), null)` → `{ value: "$19,182.00", change: "+$1,982.00", changePct: "+11.5%", tone: "gain", date: "Nov 25, 2026", startDate: "Jun 1, 2026" }`.
  - Tone: synthetic `[{…1000},{…900}]` → `tone "loss"`, change `"−$1.00"`; `[{…1000},{…1000}]` → `"flat"`, `"$0.00"`, `"0.0%"`.
  - `heroReadout(points, 0)` → change `"$0.00"`, date = first date.
  - `nextIndex(null,"ArrowLeft",10)===8`; `nextIndex(0,"ArrowLeft",10)===0`; `nextIndex(9,"ArrowRight",10)===9`; `Home→0`; `End→9`; `nextIndex(4,"a",10)===4`.
  - `indexAtX(-50,600,10)===0`; `indexAtX(650,600,10)===9`; `indexAtX(300,600,11)===5`.
  - `formatDay("2026-08-14") === "Aug 14, 2026"`.
- [ ] **Step 2: Run** `npx vitest run tests/daily.test.ts tests/format.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** in `lib/daily.ts` / `lib/format.ts` (reuse `formatMoney`, `formatSignedMoney`, `formatSignedPct`, `toneOf`).
- [ ] **Step 4: Run** same command — expected PASS.
- [ ] **Step 5: Commit** — `feat: add daily range and scrub readout math`

### Task 3: Donut arcs

**Files:**
- Create: `lib/donut.ts`
- Test: `tests/donut.test.ts`

**Interfaces:**
- Produces: `donutArcs(shares: number[], r: number, inner: number): { d: string; start: number; end: number }[]` — angles in radians from 12 o'clock clockwise; zero shares skipped; `d` is an SVG path for the ring segment. A single 100% share draws two half arcs (one SVG arc can't close a full circle).

- [ ] **Step 1: Write the failing test:** seed shares (59.2/33.0/7.8%) → 3 arcs, first `start` 0, last `end` ≈ 2π, each `end` = next `start`; `donutArcs([1],50,32)` → 1 arc whose `d` contains two `A` commands; `donutArcs([0.5,0,0.5],…)` → 2 arcs; no `d` contains `NaN`.
- [ ] **Step 2: Run** `npx vitest run tests/donut.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** `donutArcs`.
- [ ] **Step 4: Run** — expected PASS.
- [ ] **Step 5: Commit** — `feat: add donut arc geometry`

### Task 4: Hero with scrub chart

**Files:**
- Create: `app/components/PortfolioHero.tsx` (client)
- Modify: `app/components/SummaryStrip.tsx` (drop the Total value cell; keep Total gain + Cash), `app/components/Dashboard.tsx`, `lib/dashboard.ts` (add `daily: DailyPoint[]` to `DashboardView`; `buildDashboard(holdings, series, daily = [])`), `app/page.tsx` (pass `daily.seed.json`)
- Test: `tests/dashboard-ui.test.tsx`, `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: Task 2 functions, `DailyPoint`
- Produces: `<PortfolioHero daily={DailyPoint[]} />`

- [ ] **Step 1: Write the failing tests:**
  - `buildDashboard(holdings, benchmark, daily).daily` has 124 points; `buildDashboard([], benchmark, daily).daily` is `[]`.
  - Render: hero section `aria-label="Portfolio value"` contains `$19,182.00`, `+$1,982.00`, `+11.5%`, `Jun 1, 2026`, buttons `1M`, `3M`, `All` with `aria-pressed="true"` on All; element `role="slider"` with `aria-valuemin="0"`, `aria-valuemax="123"`, `aria-valuenow="123"`, and `aria-valuetext` containing `Nov 25, 2026` and `$19,182.00`; text `change in value` (case-insensitive) and `mock` both present in the hero.
  - Summary strip still shows `+$1,572.00`, `+8.9%`, `$1,500.00`.
- [ ] **Step 2: Run** `npx vitest run tests/dashboard-ui.test.tsx tests/dashboard.test.ts` — expected FAIL.
- [ ] **Step 3: Implement `PortfolioHero`:** state `range` (default All) and `active: number | null`; changing range sets `active = null`. Big value in Newsreader 40px; change line in tone colour with `startDate – date`; SVG line (2px, tone colour) with ResizeObserver width like `BenchmarkChart`; pointer move/down → `indexAtX`; pointer leave → null; focusable chart `role="slider"` handling keys via `nextIndex`; vertical scrub line + 8px dot at active point. Range buttons are outlined pills; pressed one is the Charcoal pill.
- [ ] **Step 4: Run** — expected PASS; then `npm test` — all green.
- [ ] **Step 5: Commit** — `feat: add Wealthsimple-style scrub hero`

### Task 5: Allocation donut + DESIGN.md

**Files:**
- Create: `app/components/AllocationDonut.tsx` (client, for hover)
- Modify: `app/components/AllocationPanel.tsx`, `DESIGN.md`
- Test: `tests/dashboard-ui.test.tsx`

**Interfaces:**
- Consumes: `donutArcs`, `AllocationSlice[]`
- Produces: `<AllocationDonut slices={AllocationSlice[]} total={string} />`

- [ ] **Step 1: Write the failing tests:** allocation panel has `svg[role="img"]` with `aria-label` containing `ETFs 59.2%`, `Stocks 33.0%`, `Cash 7.8%`; exactly 3 `data-slice` paths; `$19,182.00` inside the donut; empty portfolio renders no `data-slice` and still `No holdings yet`.
- [ ] **Step 2: Run** `npx vitest run tests/dashboard-ui.test.tsx` — expected FAIL.
- [ ] **Step 3: Pick 3 slice colours** (not green/red) and run the dataviz validator against `#FCFCFC` until all checks pass; record them in a comment. Implement the donut (2px paper gap between slices, hover/focus shows label + $ + %), placed left of the asset-class table on md+, stacked on mobile. Update DESIGN.md: page structure gets the hero (item 2) and the donut; replace "No pie chart" and "one line chart only" rules with the new ones and the "change in value" wording.
- [ ] **Step 4: Run** `npm test` and `npm run build` — expected all green, clean build.
- [ ] **Step 5: Verify visually:** `npx next start -p 3100`; screenshot desktop and a 390px iframe; check hero, donut, no overflow. Stop the server.
- [ ] **Step 6: Commit** — `feat: add allocation donut; update DESIGN.md`
