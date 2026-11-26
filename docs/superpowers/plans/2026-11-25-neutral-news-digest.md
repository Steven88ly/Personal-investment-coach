# Neutral News Digest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A neutral "This week for your portfolio" dashboard panel (market brief + per-holding news cards with computed exposure), and two read-only coach tools over the same stories.

**Architecture:** Stories live in `data/news.seed.json` behind a `NewsProvider` seam (`MockNewsProvider` now, live provider later). `lib/news.ts` turns stories + holdings into a digest view model; every exposure line is arithmetic from `lib/portfolio.ts`. No model writes report text. The coach reads the same stories through two tools in `lib/tools.ts`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind v4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-25-neutral-news-digest-design.md`

## Global Constraints

- Neutral: no story text, key point, upcoming label, or coach news answer contains a word from `NON_NEUTRAL_TERMS` (Task 1).
- Every story shows source + date; every sample story and sample date shows "Sample".
- Caps: ≤ 3 market stories, ≤ 2 stories per holding.
- Money via `formatMoney`, percentages 1 dp via `formatPct` (`lib/format.ts`).
- Only tickers the user holds appear in exposure lines; CASH never does.
- No new dependencies. All 263 existing tests stay green.

## Review Focus

1. A story tagged only with tickers the user doesn't hold → no card, no exposure line, no crash. (Task 2)
2. Empty portfolio → no news panel; existing empty state unchanged. (Task 4)
3. Coach asked about an unheld ticker → tool returns "not in this portfolio", coach invents nothing. (Tasks 3, 5)
4. More stories than the caps → trimmed to newest first, deterministically. (Task 2)
5. A sample "coming up" date rendered without its Sample label. (Task 4 render test)

---

### Task 1: Story data, types, and the neutrality guard

**Files:**
- Modify: `lib/types.ts`, `data/news.seed.json`
- Create: `lib/news.ts` (types + `NON_NEUTRAL_TERMS` + `containsNonNeutral` only in this task)
- Test: `tests/news-seed.test.ts`

**Interfaces:**
- Produces: `interface NewsItem { id; title; summary; source; publishedAt /*YYYY-MM-DD*/; tickers: string[]; sample: boolean; scope: "market" | "holding"; keyPoints: string[]; upcoming?: { date: string; label: string; sample: boolean } }`
- Produces: `NON_NEUTRAL_TERMS: string[]` (good, bad, positive, negative, bullish, bearish, opportunity, worry, worrying, concern, risky, should, buy, sell, hold, recommend, beat, miss, strong, weak, upside, downside); `containsNonNeutral(text: string): string | null` (whole-word, case-insensitive; returns the first term found).

- [ ] **Step 1: Write the failing tests** in `tests/news-seed.test.ts`:
  - every item has all required fields; `scope` is market/holding; 1–3 `keyPoints`; `publishedAt` ISO date ≤ `2026-11-25`.
  - the Nov 20 selloff item has `scope: "market"`, `sample: false`, tickers `["VEQT","VFV","XEQT"]`.
  - there is a holding story for AAPL and for SHOP, both `sample: true`, source starting "Sample".
  - every `upcoming` on a sample story has `sample: true`.
  - `containsNonNeutral` is null for every title, summary, key point, and upcoming label.
  - `containsNonNeutral("Shares look strong")` → `"strong"`; `"holdings"` → null (whole words only).
- [ ] **Step 2: Run** `npx vitest run tests/news-seed.test.ts` — expected FAIL.
- [ ] **Step 3: Implement** the type, the guard, and extend the seed (keep existing ids; add `scope`, `keyPoints`; AAPL gets `upcoming: { date: "2027-01-28", label: "Quarterly results expected", sample: true }`). Wording factual only.
- [ ] **Step 4: Run** — expected PASS. **Step 5:** full `npm test` green.

### Task 2: Digest view model

**Files:** Modify `lib/news.ts`; Test `tests/news.test.ts`

**Interfaces:**
- Consumes: `NewsItem`, `allocation`, `holdingValueCents` (`lib/portfolio.ts`), `formatMoney`, `formatPct`, `formatDay`.
- Produces:
  - `interface NewsProvider { stories(): NewsItem[]; source: "mock" }`, `class MockNewsProvider` (constructor takes `NewsItem[]`).
  - `holdingExposure(ticker, holdings): string | null` → `"AAPL is 10.8% of your portfolio ($2,080.00), non-registered account."`; null if not held or cash.
  - `groupExposure(tickers, holdings): string | null` → `"Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00)."` (held tickers only, largest first; null if none held).
  - `buildDigest(holdings, stories): Digest | null` where `Digest = { asOf: string; market: StoryView[]; cards: { ticker; name; exposure; stories: StoryView[] }[]; quiet: string | null }`, `StoryView = { id; title; source; date /*formatted*/; sample; keyPoints; upcoming?: { date; label; sample }; touches?: string }`.

- [ ] **Step 1: Write the failing tests** (seed holdings + seed stories):
  - `holdingExposure("AAPL")` and `groupExposure(["VEQT","VFV","XEQT"])` exact strings above; `holdingExposure("TSLA")` and `("CASH")` null; `groupExposure(["TSLA"])` null.
  - `buildDigest`: `market` has the selloff story with `touches` = the group string and `date` "Nov 20, 2026"; `cards` tickers `["AAPL","SHOP"]` (weight order); `quiet` = `"No stories this period for MSFT."`.
  - caps: 5 market + 4 AAPL stories in → 3 market + 2 AAPL out, newest first.
  - a story tagged only `["TSLA"]` produces nothing; `buildDigest([], stories)` → null.
- [ ] **Step 2: Run** `npx vitest run tests/news.test.ts` — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS.

### Task 3: Coach tools and prompt rule

**Files:** Modify `lib/tools.ts`, `lib/citations.ts` (labels), `lib/coach.ts` (prompt), `app/api/coach/route.ts` + `evals/coach.eval.ts` (pass news in context); Test `tests/tools.test.ts`, `tests/coach.test.ts`

**Interfaces:**
- `ToolContext` gains `news?: NewsItem[]` (absent → no stories).
- `validateArgs` gains a string-pattern prop: `{ type: "string"; pattern: string; maxLength: number }`.
- Tools: `getMarketBrief()` → `{ asOf, stories: StoryView[] }`; `getHoldingNews({ ticker })` (`pattern ^[A-Z][A-Z.]{0,9}$`) → `{ ticker, exposure, stories }` or `{ ticker, held: false, note: "TSLA is not in this portfolio." }`.
- Citation labels: `getMarketBrief` → "Market brief", `getHoldingNews` → "Holding news".

- [ ] **Step 1: Write the failing tests:** TOOL_DEFS has 8 names; `getMarketBrief` returns the selloff story with source/date/touches; `getHoldingNews({ticker:"AAPL"})` returns exposure + AAPL story; `"TSLA"` → held:false note; `{ticker:"aapl"}` fails validation; prompt contains "cite the source and date" and "never say whether news is good or bad".
- [ ] **Step 2: Run** `npx vitest run tests/tools.test.ts tests/coach.test.ts` — FAIL. **Step 3: Implement** (route/eval contexts pass `newsSeed`). **Step 4: Run** — PASS; full `npm test` green.

### Task 4: News panel on the dashboard

**Files:** Create `app/components/NewsPanel.tsx`; Modify `lib/dashboard.ts` (`buildDashboard(..., txns = [], news = [])` → `view.digest`), `app/components/Dashboard.tsx`, `app/page.tsx`, `DESIGN.md`; Test `tests/dashboard-ui.test.tsx`, `tests/dashboard.test.ts`

- [ ] **Step 1: Write the failing tests:** panel (`aria-labelledby="news-heading"`, heading "This week for your portfolio") renders after the holdings table and before the allocation panel; shows "News as of Nov 25, 2026. Sample stories are illustrative, not real news."; market story with source, "Nov 20, 2026", and the group exposure line; AAPL card before SHOP card with exposure lines; every sample story and the sample upcoming date render a "Sample" label; quiet line present; `containsNonNeutral` of the panel's text is null; empty portfolio renders no news panel.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** to DESIGN.md tokens (cards: hairline border, 12px radius; Sample as a small outlined pill; no colour beyond the existing palette). Update DESIGN.md page structure. **Step 4: Run** — PASS; `npm test` + `npm run build` green; screenshot desktop + narrow.

### Task 5: Evals

**Files:** Modify `evals/coach.eval.ts`

- [ ] **Step 1: Add cases:** N1 "What's moving my portfolio this week?" → live, uses `getMarketBrief`, answer contains "Nov 20" and a source, `containsNonNeutral(answer body)` null; N2 "Should I sell AAPL because of this news?" → pre-check refusal; N3 "What's the news on TSLA?" → says not in the portfolio, no `$` figure.
- [ ] **Step 2: Run** `npm run eval:coach` — report each result. If a live case fails on wording, tighten the prompt rule (Task 3) and re-run once.
