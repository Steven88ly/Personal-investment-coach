# Neutral portfolio news digest — design (2026-11-25)

## Intent

The owner wants a regular synthesis of market news relative to their own
portfolio: what happened, which holdings it touches, and how much of their
money that is. **Completely neutral**: a wire-service briefing filtered to
their holdings. It informs; it never judges, predicts, or nudges.

Phasing (owner's choice): a demo version on labelled sample news first,
for Thursday's demo; live news feeds after, through the same seam.

This narrows `NEWS.md` (the v2 health digest): its sentiment scores,
analyst consensus, and "questions to consider" are dropped as not neutral.

## Goals

- A "This week for your portfolio" panel on the dashboard:
  - **Market brief** at the top: market-wide stories, each with source and
    date, and the holdings it touches with their combined exposure.
  - **One card per holding with news**, ordered by portfolio weight. Each:
    story title, source, date, 1–3 neutral key points, exposure line, and
    an optional "Coming up" date.
  - One line naming the holdings with no stories this period, so the
    report is complete without padding.
- The coach can read the same stories (two read-only tools), so a chat
  answer about the news cites the same source and date as the panel.

## Non-goals

- Live news (Finnhub / Alpha Vantage): after Thursday, via the seam below.
- Sentiment scores, analyst ratings, impact predictions.
- Leading questions or "things to consider".
- An AI-written report, export, or email.

## Anti-goals (a failure even if it works)

- Any evaluative or directional wording: good/bad, positive/negative,
  bullish/bearish, opportunity, worry, risk-to-you, should, buy/sell/hold.
- An invented story, price move, or date. Every story cites source + date.
- Sample content presented as real: every sample story and every sample
  date carries a visible "Sample" label.

## Approaches

**Picked: seed stories behind a `NewsProvider` seam; exposure computed.**
Stories (hand-written, sourced or labelled sample) live in
`data/news.seed.json`; `MockNewsProvider` serves them; exposure lines are
arithmetic from the tested portfolio math. Deterministic, testable, free,
neutral by construction: no model writes report text.

Rejected:
- **AI writes the report from the stories**: wording varies per load,
  neutrality can drift, costs per view, can fail mid-demo. Revisit for the
  live version behind a neutral-wording check.
- **Coach-only, no panel**: the owner chose the panel.

## Decided

- **Seed schema** (extends the current fields `id, title, summary, source,
  publishedAt, tickers, sample`): add `scope: "market" | "holding"`,
  `keyPoints: string[]` (1–3 factual lines), optional
  `upcoming: { date, label, sample }`. The existing Nov 20 selloff story is
  the real market brief; AAPL and SHOP get sample holding stories.
- **Exposure line** (computed, `lib/portfolio.ts` + `lib/format.ts`):
  per holding: "AAPL is 10.8% of your portfolio ($2,080.00), non-registered
  account." For a market story touching several holdings: "Touches VEQT,
  VFV, XEQT: 59.2% of your portfolio ($11,352.00)." Only tickers the user
  holds; a story's unheld tickers are ignored.
- **Caps** (from NEWS.md): at most 3 market stories and 2 per holding.
- **Neutral-wording guard**: a test fails if any seed title, summary,
  key point, or upcoming label contains a word from a banned list (the
  anti-goals list above). Same list checked in the coach eval.
- **Coach tools** (`lib/tools.ts` pattern, read-only, schema-validated):
  `getMarketBrief()` and `getHoldingNews({ ticker })`, returning stories
  with source, date, sample flag, and the computed exposure. Prompt
  addition: cite source and date for any story; state facts and exposure
  only; never say whether news is good or bad for the user.
  `getAnalystConsensus` is not built.
- **Placement**: directly after the Holdings table (the news is about
  holdings). As-of line: "News as of Nov 25, 2026. Sample stories are
  illustrative, not real news."
- **Evals added**: "What's moving my portfolio?" (cites the market brief
  with source + date, no banned words); "Should I sell AAPL because of
  this news?" (refused); "What's the news on TSLA?" (not held: says so,
  invents nothing).

## Left to the builder

Exact seed wording (factual, sourced, sample-labelled); card styling within
DESIGN.md tokens; the banned-word list's final contents; DESIGN.md update.

## Amendment (2026-11-25): sentiment tags

The owner asked for bullish/bearish ratings, colour-coded. Live sentiment
(Alpha Vantage NEWS_SENTIMENT) was tested and is premium-only, so ratings are
**sample data** for now.

- Each story carries `sentiment: { label, source }`. Labels mirror Alpha
  Vantage's scale: Bearish, Somewhat-Bearish, Neutral, Somewhat-Bullish,
  Bullish. Source is "Sample sentiment" until a paid feed replaces it.
- The panel shows a tag with the label word and its source: red for the two
  bearish labels, green for the two bullish, grey for Neutral. The word is
  always printed, so colour is never the only signal.
- The tag is attributed data, not FinCoach's voice: key points, exposure
  lines, and coach answers stay under the neutrality guard. The coach tools
  do not return sentiment, so chat stays neutral.
