# FinCoach — AI Personal Investment Coach

An AI coach for a student investor: what you hold, how it's doing against
a benchmark, and what your contributions become over time — with every
number cited and zero investment advice.

## One-sentence pitch

A mock portfolio with an AI coach that answers "how am I doing?" from your
real holdings — allocation, gains, benchmark comparison, projections — and
refuses to tell you what to buy or sell.

## YC grounding (honest framing)

Inspired by YC Fall 2026 RFS #6, "AI consumer products for 1 billion
people" (how people shop, learn, bank, and manage money), and closest to
Winter 2027 RFS #2, "The $15-an-Hour Expert" — AI giving ordinary people
expert-level guidance. Say "inspired by YC's consumer-AI thesis", not
"a YC RFS project": YC doesn't rank its requests, and the live page has
moved on to Winter 2027 ideas.

## What it does (demo scope)

- **Portfolio dashboard:** holdings, total value, gain/loss, allocation.
- **Benchmark comparison:** portfolio vs VEQT, Jun–Nov 2026.
- **Contribution projector:** monthly amount + return + years → projected
  value, with the formula shown.
- **Diversification check:** concentration flags with plain-language reads.
- **AI coach:** grounded answers with citations; shows its work; refuses
  personalised investment advice, with a visible disclaimer.
- **Investable surplus:** income − spend from mock transactions, feeding
  the projector. Light view only.
- **Account tags:** TFSA / RRSP / FHSA / non-registered per holding.

## Stack (default — swap for what you know)

Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel.
Postgres via Supabase, or SQLite + Prisma for the demo. One LLM provider
key, server-side only, in env vars. Prices are mock, stamped with an
"as of" date — no live-price API in the MVP.

```
app/            pages (dashboard, coach chat, projector)
lib/            types.ts, money.ts (totals), portfolio.ts (value, gains,
                allocation, projections, benchmark), coach.ts
data/           holdings.seed.json, benchmark.seed.json,
                transactions.seed.json (surplus view only)
tests/          money.test.ts, portfolio.test.ts
```

## Quick start

```bash
npm install
cp .env.example .env.local   # add your LLM provider key (server-side only)
npm run dev                  # http://localhost:3000
npm test
```

## Security / advice line

- API key server-side only — never in client code, never committed to git.
- Auth on every route; demo account is seeded, no real users.
- All money math server-side; tests cover totals, gains, projections.
- Coach may only cite seeded holdings + computed aggregates. It never
  invents a price, a return, or a holding — and never recommends buying,
  selling, or holding a specific security. Educational only, disclaimer
  on every answer.
- Chat input validated, length-capped, rate-limited. No financial data
  is logged; nothing but the user's question + aggregates reaches the model.
- No real brokerage, no real money, no account numbers — mock data only.
- See `SPEC.md` for the full checklist.

## Threat model (short version — this is the SPEC.md checkbox)

Assets: the LLM API key, the demo user's (mock) holdings, the coach's
system prompt.
- **Key leak** (key in client bundle, git history, or logs) → keys live
  server-side only, in env vars; `.gitignore` covers `.env*`; a
  pre-commit secrets scan (OWASP `secrets-scan`) runs before every push.
- **Prompt injection via chat input** (user tries to make the coach
  reveal the prompt or recommend a trade) → input is validated and
  length-capped; the coach only cites tool results; the advice pre-check
  routes advice-shaped questions to the refusal template; the system
  prompt is never returned to the client.
- **Ungrounded answers** (model invents a price or holding) → the
  citation check after every answer (see AGENT.md §5); the model only
  ever sees tool results, never raw files.
- **Abuse / cost** (someone spams the coach endpoint) → auth on every
  route, per-user rate limit, 5-step max on the agent loop.
- **Out of scope for the demo:** real brokerage credentials (mock data
  only — see REAL_DATA.md for how real connections change this), DDoS,
  multi-user isolation.

## Files

- `SPEC.md` — product spec: features, data model, AI grounding + advice rules.
- `AGENT.md` — agent design: loop, six tool schemas, retry policy, eval set.
- `NEWS.md` — v2 news-aware health digest (sources, advice line, seam).
- `REAL_DATA.md` — real broker data via SnapTrade/Plaid, post-Thursday.
- `data/news.seed.json` — sample news digest for the mock Thursday view.
- `tests/portfolio.test.ts`, `tests/money.test.ts`,
  `tests/fallback-coach.test.ts` — Vitest; `npm test` green.
- `data/holdings.seed.json` — mock portfolio (VEQT-anchored, 6 holdings + cash).
- `data/benchmark.seed.json` — monthly portfolio vs VEQT, Jun–Nov 2026.
- `data/transactions.seed.json` — mock spending, surplus view only.
- `lib/coach-prompt.md` — the system prompt the coach runs under.
- `lib/portfolio.ts` — portfolio math (value, gains, allocation, projections).
