# FinCoach — Design spec (for Claude)

The brief asked for "good design principles". This is the whole
design system: one page, numbers first, in a Wealthsimple-inspired
visual direction (see below). No design tooling,
no component library — Tailwind + the tokens below.

## Page structure (single page, desktop-first, works on mobile)

1. **Header** — "FinCoach" wordmark, a `Mock data — as of Nov 25, 2026`
   badge (always visible), and the disclaimer line in small text.
2. **Portfolio summary strip** — three big numbers in a row: total value
   ($19,182), total gain (+$1,572 / +8.9%), cash ($1,500). No chart
   above the fold; the numbers are the product.
3. **Holdings table** — ticker, name, shares, avg cost, current price,
   value, gain/loss ($ and %). One row per holding, 7 rows incl. cash.
   Account tag (TFSA / RRSP / FHSA / non-registered) as a small pill
   next to the ticker. Zebra rows, right-aligned numbers, tabular
   numerals so columns line up.
4. **Benchmark panel** — line chart, portfolio vs VEQT, Jun–Nov 2026,
   with one line underneath: "Portfolio +11.5% vs VEQT +6.3% (+5.2pp)".
5. **Projector panel** — three inputs (monthly $, annual return %,
   years) with sliders + number fields, output in large type
   ($34,617 in 10 years at $200/mo, 7%), the contributions/growth split
   underneath, and the formula shown in small text. Never hide the math.
6. **Coach panel** — chat at the bottom, or a right-hand column on
   wide screens. Input + send button, answers with a "Sources" list
   under each one (the citations), the disclaimer under every answer,
   and a visible label when the answer came from the rule-based
   fallback ("Rule-based answer — live coach unavailable"). Suggested
   questions as clickable chips: the 4 eval questions + 1 refusal.

## Visual direction — Wealthsimple-inspired

Inspired by Wealthsimple's design language, not a copy of their brand:
warm paper neutrals, editorial serif display type with a quiet sans for
UI, dark pill buttons, hairline dividers, generous whitespace. No logo,
no Wealthsimple wordmark, no proprietary fonts (Tiempos and The Future
are commercial — use the free stand-ins below), no brand assets. The
point is the feel — calm, warm, plain-spoken — not a clone. That also
reads better to a reviewer than a pixel copy of a company's brand.

## Visual tokens

- **Type:** serif display + sans body. Display (the big portfolio
  number, panel headings): a warm serif — Fraunces or Newsreader from
  Google Fonts, Georgia as the fallback — 28–32px for the headline
  number, 20–24px semibold for headings. Body and UI: Inter if
  available, else system-ui, 14–15px. Numbers always tabular-nums.
- **Colour:** warm paper, not cool white. Background Linen Cream
  (#FAF8F5), cards Paper White (#FCFCFC), hairline borders Stone
  (#E4E2E1), text Graphite Ink (#32302F — warm, not pure black),
  muted text Pebble (#686664). Colour is suppressed in the chrome and
  appears only in data: gains deep green (#15803D), losses muted red
  (#B91C1C). No gradients, no purple AI glow.
- **Buttons:** dark pill buttons — Charcoal (#09090A) fill, Paper
  White text, fully rounded (pill radius), no shadow. Secondary buttons
  are outlined pills (1px Graphite border, transparent fill). Account
  tags stay small pills. No square buttons anywhere.
- **Spacing:** 24px card padding, 32px gaps between sections, max width
  1024px centred. Cards: 12px radius, 1px hairline border, no shadows.
  Whitespace carries the hierarchy — don't add borders or dividers to
  compensate.
- **Charts:** one line chart only (benchmark). Two lines, labelled
  directly, no legend box. No pie chart — the allocation table already
  says it, with exact percentages.

## States (all must exist — a demo with no error state looks unfinished)

- **Loading:** skeleton rows in the holdings table, disabled coach input.
- **Coach error / no key:** show the fallback answer with its label —
  never an empty chat or a spinner that never resolves.
- **Empty portfolio:** "No holdings yet" + a button to load the mock
  portfolio. Never a blank page, never a divide-by-zero.
- **Refusal:** the refusal answer renders like any other answer, with
  the disclaimer — no red warning box, no alarm styling. Refusing
  advice is normal behaviour here, not an error.

## Rules

- Every price carries its "as of" date; every coach answer carries its
  disclaimer and its sources. Mock data is labelled everywhere, never
  presented as live.
- Numbers: CAD with commas, 2 decimals for money, 1 decimal for
  percentages. Gains always show $ and % together.
- Mobile: panels stack in the order above; the holdings table scrolls
  horizontally rather than crushing columns.
- Accessibility: labels on every input, focus-visible outlines,
  sufficient contrast on muted text, chart has a text alternative
  (the "+11.5% vs +6.3%" line).
- **Cut:** no dark mode, no animations beyond a 150ms hover, no extra
  pages. If it doesn't help a reviewer judge the engineering, it doesn't
  ship Thursday.
