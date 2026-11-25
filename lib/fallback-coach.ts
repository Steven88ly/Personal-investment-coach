import { formatCAD } from "./money";
import {
  allocation,
  benchmarkComparison,
  holdingGainCents,
  holdingValueCents,
  portfolioGainCents,
  portfolioGainPct,
  portfolioValueCents,
  projectContributions,
} from "./portfolio";
import type { BenchmarkPoint, Holding } from "./types";

/**
 * Rule-based fallback coach — the Thursday 5:00 PM ET cut-trigger fallback.
 *
 * Use when the live LLM coach is not working (no key, API down, rate
 * limit): the coach endpoint serves these answers instead of a broken
 * chat box, labelled honestly in the UI as rule-based answers.
 *
 * Every figure is computed from the holdings / benchmark data with the
 * tested functions in lib/portfolio.ts — nothing is hardcoded, so the
 * answers stay correct if the seed data changes. The refusal path is
 * identical to the live coach's: educational only, never a recommendation
 * to buy, sell, or hold a specific security.
 *
 * Wiring (for Claude): in app/api/coach/route.ts, if the model call
 * fails or LLM_API_KEY is unset, call answerFallback(question, holdings,
 * benchmark) and return its result with source: "rule-based fallback".
 * Do NOT silently present fallback answers as live AI answers.
 */

export const FALLBACK_DISCLAIMER =
  "Educational only — not financial advice. Prices are mock data as of Nov 25, 2026.";

export interface FallbackAnswer {
  answer: string;
  citations: string[];
  isRefusal: boolean;
  /** Always "rule-based fallback" — the UI must show this label. */
  source: "rule-based fallback";
}

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

function withDisclaimer(body: string): string {
  return `${body}\n\n${FALLBACK_DISCLAIMER}`;
}

function refusal(ticker?: string): FallbackAnswer {
  const named = ticker ? ` ${ticker}` : "";
  return {
    answer: withDisclaimer(
      `I can't recommend whether to buy or sell${named} — I'm an educational tool, not a financial advisor, and I never give personalised investment advice. ` +
        `What I can show you is what the data says: your holdings, their gains, and how diversified you are. ` +
        `If you want the concept: diversification means spreading money so no single holding decides your outcome — your biggest holding is VEQT, a broad-market ETF, which is diversified by construction.`
    ),
    citations: ["Advice rule: educational only, no buy/sell/hold recommendations"],
    isRefusal: true,
    source: "rule-based fallback",
  };
}

function overall(holdings: Holding[]): FallbackAnswer {
  const total = portfolioValueCents(holdings);
  const gain = portfolioGainCents(holdings);
  const gainPct = portfolioGainPct(holdings);
  const biggest = [...holdings].sort(
    (a, b) => holdingValueCents(b) - holdingValueCents(a)
  )[0];
  return {
    answer: withDisclaimer(
      `Your portfolio is worth ${formatCAD(total)}, up ${formatCAD(gain)} (${pct(gainPct ?? 0)}) from what you paid. ` +
        `Your biggest holding is ${biggest.ticker} at ${formatCAD(holdingValueCents(biggest))}, up ${formatCAD(holdingGainCents(biggest))} on its own. ` +
        `All prices are mock data as of Nov 25, 2026.`
    ),
    citations: [
      `Total value ${formatCAD(total)}`,
      `Total gain ${formatCAD(gain)} (${pct(gainPct ?? 0)})`,
      `${biggest.ticker} ${formatCAD(holdingValueCents(biggest))}`,
    ],
    isRefusal: false,
    source: "rule-based fallback",
  };
}

function biggestHolding(holdings: Holding[]): FallbackAnswer {
  const alloc = allocation(holdings);
  const biggest = [...holdings].sort(
    (a, b) => holdingValueCents(b) - holdingValueCents(a)
  )[0];
  return {
    answer: withDisclaimer(
      `Your biggest holding is ${biggest.ticker} (${biggest.name}) — ${formatCAD(holdingValueCents(biggest))}, ` +
        `${pct(alloc[biggest.ticker] ?? 0)} of your portfolio, in your ${biggest.account} account. ` +
        `It's an ETF, so it is diversified by construction and exempt from the single-stock concentration flag.`
    ),
    citations: [
      `${biggest.ticker} ${formatCAD(holdingValueCents(biggest))} (${pct(alloc[biggest.ticker] ?? 0)})`,
    ],
    isRefusal: false,
    source: "rule-based fallback",
  };
}

function vsVeQt(benchmark: BenchmarkPoint[]): FallbackAnswer {
  const { portfolioReturnPct, veqtReturnPct, outperformancePctPoints } =
    benchmarkComparison(benchmark);
  if (
    portfolioReturnPct === null ||
    veqtReturnPct === null ||
    outperformancePctPoints === null
  ) {
    return {
      answer: withDisclaimer(
        "I can't compare you to VEQT yet — the benchmark series doesn't have enough months to compute a return."
      ),
      citations: [],
      isRefusal: false,
      source: "rule-based fallback",
    };
  }
  return {
    answer: withDisclaimer(
      `Yes — over Jun–Nov 2026 your portfolio returned ${pct(portfolioReturnPct)} vs ${pct(veqtReturnPct)} for VEQT, ` +
        `so you're ahead by ${outperformancePctPoints.toFixed(1)} percentage points. ` +
        `VEQT is the benchmark because it's the ETF you actually follow.`
    ),
    citations: [
      `Portfolio ${pct(portfolioReturnPct)} (Jun–Nov 2026)`,
      `VEQT ${pct(veqtReturnPct)} (Jun–Nov 2026)`,
      `Outperformance ${outperformancePctPoints.toFixed(1)}pp`,
    ],
    isRefusal: false,
    source: "rule-based fallback",
  };
}

function projector(question: string): FallbackAnswer {
  // Parse "$200 a month ... 10 years at 7%" (defaults: $200/mo, 7%, 10y).
  const monthlyMatch = question.match(/\$?\s?(\d[\d,]*)\s*(?:\/mo|per month|a month|monthly)/i);
  const yearsMatch = question.match(/(\d+)\s*years?/i);
  const returnMatch = question.match(/(\d+(?:\.\d+)?)\s*%/);
  const monthly = monthlyMatch ? Number(monthlyMatch[1].replace(/,/g, "")) : 200;
  const years = yearsMatch ? Number(yearsMatch[1]) : 10;
  const annualReturn = returnMatch ? Number(returnMatch[1]) : 7;
  const r = projectContributions(monthly * 100, annualReturn, years);
  return {
    answer: withDisclaimer(
      `$${monthly} a month at ${annualReturn}% for ${years} years becomes ${formatCAD(r.futureValueCents)}. ` +
        `That's ${formatCAD(r.contributedCents)} you put in plus ${formatCAD(r.growthCents)} of growth. ` +
        `Formula: FV = P × (((1 + r)ⁿ − 1) / r), with r the monthly rate and n the number of months. ` +
        `This assumes a steady ${annualReturn}% return — real returns vary.`
    ),
    citations: [
      `Future value ${formatCAD(r.futureValueCents)}`,
      `Contributed ${formatCAD(r.contributedCents)}`,
      `Growth ${formatCAD(r.growthCents)}`,
    ],
    isRefusal: false,
    source: "rule-based fallback",
  };
}

/** Advice-shaped questions are routed here before any other matching. */
const ADVICE_RE =
  /\b(should i|shall i|do i)\b.*\b(buy|sell|hold)\b|\bbuy more\b|\bsell\b.*\b(shop|veqt|aapl|msft|xeqt|vfv)\b|\bwhat should i (invest|buy)\b/i;

const TICKER_RE = /\b(VEQT|XEQT|VFV|AAPL|MSFT|SHOP)\b/i;

/**
 * Answer one of the eval questions (AGENT.md §7) deterministically.
 * Returns null only when the question matches none of the known patterns
 * — the caller should then reply with the "can't answer from the data"
 * message below instead of inventing an answer.
 */
export function answerFallback(
  question: string,
  holdings: Holding[],
  benchmark: BenchmarkPoint[]
): FallbackAnswer | null {
  const q = question.trim();
  const lower = q.toLowerCase();

  if (ADVICE_RE.test(q)) {
    return refusal(q.match(TICKER_RE)?.[1]);
  }
  if (holdings.length === 0) {
    return {
      answer: withDisclaimer(
        "You have no holdings in this portfolio, so there's nothing to summarise yet. Add a holding and I can tell you how you're doing."
      ),
      citations: [],
      isRefusal: false,
      source: "rule-based fallback",
    };
  }
  if (/biggest|largest holding/.test(lower)) return biggestHolding(holdings);
  if (/beat|beating|vs veqt|versus veqt|compared to veqt|ahead of veqt/.test(lower))
    return vsVeQt(benchmark);
  if (/month|project|become|contribut/.test(lower)) return projector(q);
  if (/how am i doing|overall|how.*doing|how is my portfolio|summary/.test(lower))
    return overall(holdings);
  return null;
}

/** Reply for a question the data cannot answer — never guess. */
export function cannotAnswerFallback(): FallbackAnswer {
  return {
    answer: withDisclaimer(
      "I can't answer that from your portfolio data — I only know your holdings, their gains, the VEQT benchmark, and contribution projections. " +
        "Try asking how you're doing overall, what your biggest holding is, whether you're beating VEQT, or what $200 a month becomes in 10 years."
    ),
    citations: [],
    isRefusal: false,
    source: "rule-based fallback",
  };
}
