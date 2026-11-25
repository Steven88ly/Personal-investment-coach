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

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind v4 on Vercel. No database:
the demo portfolio is seed JSON, and prices are mock, stamped "as of
Nov 25, 2026". The coach calls OpenAI (gpt-4o-mini) from the server only.

```
app/            dashboard page, /login, components/
app/api/        coach (AI coach), login, logout
middleware.ts   auth on every route
lib/            portfolio.ts, money.ts (tested math), dashboard.ts (view model),
                agent.ts (tool loop), tools.ts (6 read-only tools),
                citations.ts, openai.ts (retry policy), coach.ts,
                auth.ts (sessions), rate-limit.ts, coach-prompt.md
data/           holdings, benchmark, daily (generated), transactions — all mock
tests/          Vitest unit + render tests (`npm test`)
evals/          live coach eval set (`npm run eval:coach`)
```

## Quick start

```bash
npm install
cp .env.example .env.local
# In .env.local set: DEMO_PASS (12+ chars), SESSION_SECRET (32+ random chars),
# and optionally LLM_API_KEY (without it the coach uses the rule-based fallback).
npm run dev          # http://localhost:3000, sign in with DEMO_USER / DEMO_PASS
npm test             # unit + render tests
npm run eval:coach   # live eval against the model (needs LLM_API_KEY)
```

## Advice line

The coach is educational only. It never recommends buying, selling, or
holding a specific security; advice-shaped questions are refused before they
reach the model, and the model is told to refuse anything that slips past.
Every answer carries a disclaimer, every figure in it is checked against the
tool results it came from, and every price is labelled mock.

## Threat model

**What's worth protecting.** The OpenAI key and the credit behind it; the
session secret and demo password (together they gate everything); the
integrity of what the coach says (no invented numbers, no advice). The
portfolio itself is mock data with no real accounts, money, or personal
details, so data theft has little to steal by design.

**Trust boundaries.** Browser → Next.js server (middleware + route
handlers) → OpenAI. Secrets live only in `.env.local` (git-ignored) and in
Vercel's encrypted environment variables.

| Threat | Control | Evidence |
|---|---|---|
| API key leaks via the browser bundle, git, logs, or errors | Read only in `app/api/coach`; no `NEXT_PUBLIC_` vars; `.env*` git- and Vercel-ignored; client errors never carry the key | `tests/openai.test.ts`; bundle grep and full git-history scan: clean |
| Anyone with the URL uses the app or drains credit | Sign-in required on every page and API (middleware), checked again inside `/api/coach`; 10 questions/min per user+IP; daily cap on live model calls (`COACH_DAILY_LIMIT`, default 300), then the labelled fallback | `tests/middleware.test.ts`, `tests/coach-route.test.ts` |
| Password guessing | 5 sign-in attempts/min per IP; constant-time credential compare; sign-in fails closed if the password is missing, under 12 chars, or the old template default | `tests/auth.test.ts`, `tests/login-route.test.ts` |
| Forged or stolen session | HMAC-SHA256-signed cookie, 8 h expiry, `HttpOnly; Secure; SameSite=Lax`; secret is 32+ chars and differs per environment; rotating it signs everyone out | `tests/auth.test.ts` |
| Cross-site request forgery | `SameSite=Lax` cookie; `/api/coach` accepts `application/json` only (a cross-site form can't send it); CSP `form-action 'self'` | `tests/coach-route.test.ts` |
| Open redirect after sign-in | `next` must be a same-site path, else `/` | `tests/auth.test.ts` |
| XSS through questions or answers | React escapes all text; no raw-HTML rendering anywhere; HTML stripped from questions; CSP limits scripts, styles, and connections to this origin | `tests/coach.test.ts` |
| Clickjacking | `frame-ancestors 'none'` and `X-Frame-Options: DENY` | `tests/login-page.test.tsx` |
| Oversized or malformed input | Question 1–500 chars; body ≤ 2 KB (413); bad JSON → 400 | `tests/coach-route.test.ts` |
| Prompt injection: user talks the coach into advice | Three layers: advice pre-check before the model; system prompt rules; the model has only six **read-only** tools, so no prompt can make it act | `tests/agent.test.ts`; live evals Q5/Q6 (pre-check) and Q5b/Q6b (model refuses paraphrases) |
| Ungrounded answers: model invents a price or return | Tools return pre-computed, tested figures; every $ and % in an answer must match a tool result or the user's question, else one regeneration, then the figure is removed and the answer says so | `tests/citations.test.ts`, `tests/agent.test.ts` |
| Runaway agent loop or retry storm | Max 5 steps; a tool failing twice ends the loop; backoff 1 s/2 s/4 s then give up; never retries 400/401/403 | `tests/agent.test.ts`, `tests/openai.test.ts` |
| Financial data in logs | Questions and answers are never logged; the only log lines are a model-failure class/status and "sign-in not configured" | code review: two `console.warn` calls, both value-free |
| Build tampering or outage via third-party fetches | Fonts self-hosted (no build-time Google Fonts fetch) | `tests/fonts.test.ts` |

**Accepted risks (known, deliberate for a one-user demo).**
- Rate limits and the daily cap are in memory, so each Vercel instance keeps
  its own count. A real deployment would use a shared store (e.g. Redis).
- The CSP allows `'unsafe-inline'` scripts, which Next.js's App Router needs
  without per-request nonces. Every other directive is `'self'` or `'none'`.
- One shared demo account: anyone given the password has full access to the
  mock data and the coach. Rotate `DEMO_PASS` and `SESSION_SECRET` after demos.
- The system prompt is in this public repo, so it isn't a secret. Nothing in
  it is sensitive.
- `npm audit` flags the PostCSS bundled inside Next.js 15. It only runs at
  build time on this app's own CSS; the fix is the Next 16 major upgrade.
- No pre-commit secret-scanning hook yet. Scans were run by hand before each
  security-relevant commit; adding `gitleaks` as a hook is the next step.

**Out of scope for the demo.** Real brokerage connections (see
`REAL_DATA.md` for how they would change this model: encrypted token storage,
read-only scopes, revocation), multiple users and per-user data isolation,
and volumetric DDoS (left to Vercel's platform protection).

## Files

- `SPEC.md` — product spec: features, data model, AI grounding + advice rules.
- `DESIGN.md` — the design system and page structure.
- `AGENT.md` — agent design: loop, six tool schemas, retry policy, eval set.
- `NEWS.md` — v2 news-aware health digest (sources, advice line, seam).
- `REAL_DATA.md` — real broker data via SnapTrade/Plaid, after the demo.
- `lib/coach-prompt.md` — the system prompt the coach runs under.
- `docs/superpowers/` — design spec and build plan for the scrub chart and pie.
