import { formatAsOf, formatMoney, formatMonth, formatSignedMoney } from "./format";
import {
  allocation,
  allocationByAssetClass,
  benchmarkComparison,
  diversificationChecks,
  diversificationFlags,
  holdingGainCents,
  holdingGainPct,
  holdingValueCents,
  portfolioCostCents,
  portfolioGainCents,
  portfolioGainPct,
  portfolioValueCents,
  projectContributions,
} from "./portfolio";
import { buildDigest, holdingExposure, type StoryView } from "./news";
import type { BenchmarkPoint, Holding, NewsItem } from "./types";

/**
 * The coach's six tools (AGENT.md §3). All read-only and deterministic:
 * every number comes from the tested math in lib/portfolio.ts, pre-formatted
 * so the model quotes figures instead of computing them. No write, trade, or
 * delete tool exists. Results are small objects, lists capped at 10 items.
 */

export interface ToolContext {
  holdings: Holding[];
  benchmark: BenchmarkPoint[];
  /** Neutral news digest stories; absent means no news configured. */
  news?: NewsItem[];
}

type Prop =
  | { type: "integer" | "number"; minimum: number; maximum: number; description: string }
  | { type: "string"; enum: string[]; description: string }
  | { type: "string"; pattern: string; maxLength: number; description: string };

export interface ToolDef {
  name: string;
  description: string;
  parameters: { type: "object"; properties: Record<string, Prop>; required?: string[]; additionalProperties: false };
}

const noParams = { type: "object", properties: {}, additionalProperties: false } as const;

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "getPortfolioSummary",
    description:
      "Portfolio totals: number of holdings, total value, total cost, gain/loss in $ and %, cash and cash share. Use for 'how am I doing' or any overall question.",
    parameters: noParams,
  },
  {
    name: "getHoldings",
    description:
      "Individual holdings (ticker, name, account, asset class, shares, avg cost, mock price, value, gain $ and %, share of portfolio). Optionally filter by account or asset class. Use for questions about specific holdings or accounts.",
    parameters: {
      type: "object",
      properties: {
        account: { type: "string", enum: ["TFSA", "RRSP", "FHSA", "non-registered"], description: "Only holdings in this account." },
        assetClass: { type: "string", enum: ["ETF", "stock", "cash"], description: "Only holdings of this asset class." },
      },
      additionalProperties: false,
    },
  },
  {
    name: "getAllocation",
    description:
      "Each holding's share of total portfolio value, largest first, plus the split by asset class. Use for 'biggest holding' or allocation questions.",
    parameters: noParams,
  },
  {
    name: "getBenchmarkComparison",
    description:
      "Portfolio total return vs the VEQT ETF over Jun–Nov 2026, and the difference in percentage points. Use for 'am I beating VEQT' or performance-vs-benchmark questions.",
    parameters: noParams,
  },
  {
    name: "getDiversificationFlags",
    description:
      "Concentration flags (single stock over 25% of the portfolio, over 40% of stocks, cash over 15%) with plain-language reasons, plus what each check found. ETFs are exempt. Use for diversification or risk questions.",
    parameters: noParams,
  },
  {
    name: "projectContributions",
    description:
      "Projects regular monthly contributions forward: future value, total contributed, and growth, using FV = P × ((1 + r)^n − 1) / r. Use when the user asks what a monthly amount becomes. Pass the user's own assumptions.",
    parameters: {
      type: "object",
      properties: {
        monthlyCents: { type: "integer", minimum: 0, maximum: 10_000_000, description: "Monthly contribution in CAD cents ($200 = 20000)." },
        annualReturnPct: { type: "number", minimum: -10, maximum: 30, description: "Assumed annual return in percent (7 = 7%)." },
        years: { type: "integer", minimum: 1, maximum: 40, description: "Number of years." },
      },
      required: ["monthlyCents", "annualReturnPct", "years"],
      additionalProperties: false,
    },
  },
  {
    name: "getMarketBrief",
    description:
      "This period's market-wide news stories: title, source, date, factual key points, and which of the user's holdings each touches with their combined share and value. Use for 'what's moving my portfolio' or market news questions.",
    parameters: noParams,
  },
  {
    name: "getHoldingNews",
    description:
      "News stories about one ticker: title, source, date, factual key points, any upcoming date, and the user's exposure to that holding. Says so if the ticker isn't held. Use for news about a specific holding.",
    parameters: {
      type: "object",
      properties: {
        ticker: { type: "string", pattern: "^[A-Z][A-Z.]{0,9}$", maxLength: 10, description: "Ticker in capitals, e.g. AAPL." },
      },
      required: ["ticker"],
      additionalProperties: false,
    },
  },
];

const BY_NAME = new Map(TOOL_DEFS.map((t) => [t.name, t]));

export type Validation = { ok: true; args: Record<string, unknown> } | { ok: false; error: string };

/** Checks args against the tool's JSON schema before anything runs. */
export function validateArgs(name: string, args: unknown): Validation {
  const def = BY_NAME.get(name);
  if (!def) {
    return { ok: false, error: `Unknown tool "${name}". Available: ${TOOL_DEFS.map((t) => t.name).join(", ")}.` };
  }
  if (typeof args !== "object" || args === null || Array.isArray(args)) {
    return { ok: false, error: `${name}: arguments must be a JSON object.` };
  }
  const obj = args as Record<string, unknown>;
  const { properties, required = [] } = def.parameters;
  for (const key of Object.keys(obj)) {
    if (!(key in properties)) return { ok: false, error: `${name}: unknown argument "${key}".` };
  }
  for (const key of required) {
    if (obj[key] === undefined) return { ok: false, error: `${name}: missing required argument "${key}".` };
  }
  for (const [key, prop] of Object.entries(properties)) {
    const v = obj[key];
    if (v === undefined) continue;
    if (prop.type === "string") {
      if ("enum" in prop) {
        if (typeof v !== "string" || !prop.enum.includes(v)) {
          return { ok: false, error: `${name}: "${key}" must be one of ${prop.enum.join(", ")}.` };
        }
      } else if (typeof v !== "string" || v.length > prop.maxLength || !new RegExp(prop.pattern).test(v)) {
        return { ok: false, error: `${name}: "${key}" must match ${prop.pattern}.` };
      }
      continue;
    }
    if (typeof v !== "number" || !Number.isFinite(v)) return { ok: false, error: `${name}: "${key}" must be a number.` };
    if (prop.type === "integer" && !Number.isInteger(v)) return { ok: false, error: `${name}: "${key}" must be a whole number.` };
    if (v < prop.minimum || v > prop.maximum) {
      return { ok: false, error: `${name}: "${key}" must be between ${prop.minimum} and ${prop.maximum}.` };
    }
  }
  return { ok: true, args: obj };
}

const MAX_ITEMS = 10;
const pct2 = (fraction: number) => `${(fraction * 100).toFixed(2)}%`;
const signedPct2 = (fraction: number) => {
  const s = (fraction * 100).toFixed(2);
  return Number(s) > 0 ? `+${s}%` : `${s.replace("-", "−")}%`;
};
const NO_HOLDINGS = { holdingsCount: 0, note: "No holdings in this portfolio." };

/** Runs a validated tool call. Pure: same args, same result. */
export function executeTool(name: string, args: Record<string, unknown>, ctx: ToolContext): unknown {
  const { holdings, benchmark } = ctx;
  const total = portfolioValueCents(holdings);
  const alloc = allocation(holdings);

  switch (name) {
    case "getPortfolioSummary": {
      if (holdings.length === 0) return NO_HOLDINGS;
      const cash = holdings.filter((h) => h.assetClass === "cash").reduce((s, h) => s + holdingValueCents(h), 0);
      return {
        holdingsCount: holdings.length,
        totalValue: formatMoney(total),
        totalCost: formatMoney(portfolioCostCents(holdings)),
        gain: formatSignedMoney(portfolioGainCents(holdings)),
        gainPct: signedPct2(portfolioGainPct(holdings) ?? 0),
        cash: formatMoney(cash),
        cashSharePct: pct2(cash / total),
        pricesAsOf: `${formatAsOf(holdings[0].priceAsOf)} (mock data)`,
      };
    }
    case "getHoldings": {
      if (holdings.length === 0) return NO_HOLDINGS;
      const rows = holdings
        .filter((h) => (args.account ? h.account === args.account : true))
        .filter((h) => (args.assetClass ? h.assetClass === args.assetClass : true))
        .slice(0, MAX_ITEMS)
        .map((h) => ({
          ticker: h.ticker,
          name: h.name,
          account: h.account,
          assetClass: h.assetClass,
          shares: h.shares,
          avgCost: formatMoney(h.avgCostCents),
          mockPrice: formatMoney(h.currentPriceCents),
          value: formatMoney(holdingValueCents(h)),
          gain: formatSignedMoney(holdingGainCents(h)),
          gainPct: signedPct2(holdingGainPct(h) ?? 0),
          shareOfPortfolioPct: pct2(alloc[h.ticker] ?? 0),
        }));
      return { holdings: rows, pricesAsOf: `${formatAsOf(holdings[0].priceAsOf)} (mock data)` };
    }
    case "getAllocation": {
      if (holdings.length === 0) return NO_HOLDINGS;
      return {
        byHolding: [...holdings]
          .sort((a, b) => holdingValueCents(b) - holdingValueCents(a))
          .slice(0, MAX_ITEMS)
          .map((h) => ({ ticker: h.ticker, sharePct: pct2(alloc[h.ticker] ?? 0), value: formatMoney(holdingValueCents(h)) })),
        byAssetClassPct: Object.fromEntries(
          Object.entries(allocationByAssetClass(holdings)).map(([cls, share]) => [cls, pct2(share ?? 0)])
        ),
      };
    }
    case "getBenchmarkComparison": {
      const c = benchmarkComparison(benchmark);
      if (c.portfolioReturnPct === null || c.veqtReturnPct === null || c.outperformancePctPoints === null) {
        return { note: "Not enough benchmark data to compare." };
      }
      const pp = c.outperformancePctPoints.toFixed(2);
      return {
        period: `${monthYear(benchmark[0].month)} to ${monthYear(benchmark.at(-1)!.month)} (mock data)`,
        portfolioReturnPct: signedPct2(c.portfolioReturnPct),
        veqtReturnPct: signedPct2(c.veqtReturnPct),
        differencePp: `${Number(pp) > 0 ? "+" : ""}${pp}pp`,
      };
    }
    case "getDiversificationFlags": {
      if (holdings.length === 0) return NO_HOLDINGS;
      return {
        flags: diversificationFlags(holdings),
        checks: diversificationChecks(holdings).map((c) => `${c.ok ? "Clear" : "Flag"}: ${c.line}`),
      };
    }
    case "projectContributions": {
      const monthlyCents = args.monthlyCents as number;
      const ratePct = args.annualReturnPct as number;
      const years = args.years as number;
      const r = projectContributions(monthlyCents, ratePct, years);
      return {
        monthly: formatMoney(monthlyCents),
        annualReturnPct: `${ratePct}%`,
        years,
        futureValue: formatMoney(r.futureValueCents),
        contributed: formatMoney(r.contributedCents),
        growth: formatMoney(r.growthCents),
        formula: "FV = P × ((1 + r)^n − 1) / r, r = annual rate / 12, n = years × 12",
      };
    }
    case "getMarketBrief": {
      const digest = buildDigest(holdings, ctx.news ?? []);
      if (!digest) return NO_HOLDINGS;
      return { asOf: digest.asOf, stories: digest.market.map(withoutSentiment) };
    }
    case "getHoldingNews": {
      const ticker = args.ticker as string;
      const exposure = holdingExposure(ticker, holdings);
      if (!exposure) return { ticker, held: false, note: `${ticker} is not in this portfolio.` };
      const card = buildDigest(holdings, ctx.news ?? [])?.cards.find((c) => c.ticker === ticker);
      return card
        ? { ticker, exposure, stories: card.stories.map(withoutSentiment) }
        : { ticker, exposure, stories: [], note: `No stories this period for ${ticker}.` };
    }
    default:
      throw new Error(`Unknown tool "${name}"`);
  }
}

/** Sentiment is panel-only attributed data; the coach never sees it, so chat stays neutral. */
function withoutSentiment(story: StoryView): Omit<StoryView, "sentiment"> {
  const { sentiment: _omit, ...rest } = story;
  return rest;
}

/** "2026-06" → "Jun 2026". */
const monthYear = (ym: string) => `${formatMonth(ym)} ${ym.slice(0, 4)}`;
