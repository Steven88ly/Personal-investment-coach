# FinCoach — Spec v2: Personal Investment Coach

> PIVOT (Nov 25): the investment coach was chosen over the spending coach.
> The spending scaffold (transactions, categorizer) is kept only as the
> "investable surplus" view. Everything below is the investment product.

## Problem

A student investor checks a brokerage balance and sees one number. It never
says whether they're diversified, how they're doing against a benchmark,
or what their monthly contributions actually become over 5–10 years.

## Users

One demo user: a Montreal student. All data is seeded mock data — no real
brokerage connection, no real money, no real account numbers.

## Features (MVP — Thursday night cutoff, nothing beyond this list)

### 1. Portfolio dashboard
- Holdings table: ticker, shares, avg cost, current (mock) price, market
  value, gain/loss in $ and %.
- Total value, total gain/loss, day change (mock).
- Allocation breakdown by holding and by asset class (ETF / stock / cash).
- Prices are mock, stamped "as of Nov 25, 2026 — illustrative data".
  No live-price API in the MVP.

### 2. Benchmark comparison
- Portfolio vs VEQT (Vanguard All-Equity ETF) over Jun–Nov 2026, from
  `data/benchmark.seed.json`. Line chart + "you're +X% vs VEQT" line.
- VEQT is the benchmark because the user actually follows it — this is
  a personal, credible comparison, not a generic one.

### 3. Contribution projector ("what-if")
- Inputs: monthly contribution, assumed annual return, years.
- Output: projected value at 5 / 10 years, contributions vs growth split.
- Math in `lib/portfolio.ts`, tested. Formula shown in the UI — no
  black-box numbers.

### 4. Diversification / risk check
- Concentration flags: any single stock >25% of the portfolio, any single
  stock >40% of equities, cash drag note if cash >15%. ETFs are exempt
  from the 25% rule — a broad-market ETF can be a third of a portfolio
  and still be diversified.
- One-line plain-language read per flag. No risk score theatre — flags
  with reasons, not a magic number.

### 5. AI coach (chat) — the headline feature
- Answers from holdings + aggregates + benchmark data ONLY, with
  citations ("VEQT is 36% of your portfolio — $6,900 of $19,182").
- Shows its work: every answer lists the holdings/figures it used.
- **Advice line (non-negotiable):** educational only. Never recommends
  buying, selling, or holding a specific security. Refuses advice
  questions plainly and explains why, offering an educational answer
  instead. A disclaimer is visible on every coach answer.
- Refusal rule: if the data can't answer, say so. Never invent a price,
  a return, or a holding.

### 6. Investable surplus (light — reuses the spending scaffold)
- Income − spend from `data/transactions.seed.json` = monthly surplus.
- One line: "You had ~$X left in October — at $200/mo that becomes…"
  linking surplus to the projector. No full budgeting UI in the MVP.

### 7. Account tags (Canadian touch)
- Every holding tagged TFSA / RRSP / FHSA / non-registered.
- One line per account explaining the tag in plain language. No tax
  advice — the tag is informational only.

## Data model

```ts
Holding { ticker, name, shares, avgCostCents, currentPriceCents,
  currency: "CAD", account: "TFSA" | "RRSP" | "FHSA" | "non-registered",
  assetClass: "ETF" | "stock" | "cash", priceAsOf: "2026-11-25" }
BenchmarkPoint { month: "2026-06", portfolioValueCents, veqtPriceCents }
```

Seed: `data/holdings.seed.json` (6 holdings + cash), `data/benchmark.seed.json`
(Jun–Nov 2026). Prices are mock/illustrative — labelled as such everywhere.

## v2 (after Thursday)

- **News-aware portfolio health** — see `NEWS.md`: news matched to
  holdings, market brief, analyst consensus, with the advice line held
  (health check, never a recommendation). Thursday ships a mock digest
  from `data/news.seed.json` only if Tier 1 is green before the 5 PM cut.
- **Real broker data** — see `REAL_DATA.md` (SnapTrade after Thursday).

## Acceptance criteria (Thursday night)

- [ ] Dashboard renders: total value, gain/loss, allocation — all match
      the seed data (tests pass).
- [ ] Benchmark chart renders; "vs VEQT" figure is correct.
- [ ] Projector math correct at $200/mo, 7%, 5y and 10y (tests pass).
- [ ] Diversification flags fire correctly on the seed data.
- [ ] Coach answers 4 test questions with cited, correct numbers and
      refuses 2 advice questions ("Should I buy more VEQT?", "Should I
      sell SHOP?") with the disclaimer shown.
- [ ] `npm test` green; README threat model written; deployed on Vercel.
- [ ] No secrets in git history; no financial data in logs; mock-data
      labels visible in the UI.
