import {
  formatAsOf,
  formatMoney,
  formatMonth,
  formatPct,
  formatSignedMoney,
  formatSignedPct,
  toneOf,
  type Tone,
} from "./format";
import {
  allocation,
  allocationByAssetClass,
  benchmarkComparison,
  holdingGainCents,
  holdingGainPct,
  holdingValueCents,
  indexedBenchmark,
  portfolioGainCents,
  portfolioGainPct,
  portfolioValueCents,
} from "./portfolio";
import type { AccountType, AssetClass, BenchmarkPoint, DailyPoint, Holding } from "./types";

/**
 * The dashboard's view model: every number the page shows, computed and
 * formatted server-side from lib/portfolio.ts. Components only render it.
 */

export interface HoldingRow {
  ticker: string;
  name: string;
  account: AccountType;
  assetClass: AssetClass;
  /** null for cash: per-share and gain figures don't apply. */
  shares: string | null;
  avgCost: string | null;
  price: string | null;
  value: string;
  gain: string | null;
  gainPct: string | null;
  tone: Tone;
}

export interface AllocationSlice {
  label: string;
  value: string;
  pct: string;
  share: number;
}

export interface HoldingSlice {
  ticker: string;
  name: string;
  pct: string;
  share: number;
}

export interface BenchmarkView {
  summary: string;
  portfolioPct: string;
  veqtPct: string;
  differencePp: string;
  tone: Tone;
  /** Plain-language panel heading, e.g. "You're 5.2 percentage points ahead of VEQT since June." */
  headline: string;
  points: {
    label: string;
    month: string;
    portfolioPct: number;
    veqtPct: number;
    portfolioValue: string;
    veqtPrice: string;
    portfolioChange: string;
    veqtChange: string;
  }[];
}

export interface DashboardView {
  isEmpty: boolean;
  asOf: string;
  totals: { value: string; gain: string; gainPct: string; tone: Tone; cash: string };
  rows: HoldingRow[];
  byAssetClass: AllocationSlice[];
  byHolding: HoldingSlice[];
  benchmark: BenchmarkView | null;
  /** Generated mock daily series for the scrub hero; empty when there are no holdings. */
  daily: DailyPoint[];
}

const ASSET_CLASS_LABELS: Record<AssetClass, string> = {
  ETF: "ETFs",
  stock: "Stocks",
  cash: "Cash",
};
const ASSET_CLASS_ORDER: AssetClass[] = ["ETF", "stock", "cash"];
const SEED_AS_OF = "2026-11-25";
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function benchmarkHeadline(pp: number, firstMonth: string): string {
  const since = MONTH_NAMES[Number(firstMonth.split("-")[1]) - 1];
  const gap = Math.abs(pp).toFixed(1);
  if (gap === "0.0") return `You're even with VEQT since ${since}.`;
  const side = pp > 0 ? "ahead of" : "behind";
  return `You're ${gap} percentage points ${side} VEQT since ${since}.`;
}

const shareCount = new Intl.NumberFormat("en-CA", { maximumFractionDigits: 4 });

function toRow(h: Holding): HoldingRow {
  const isCash = h.assetClass === "cash";
  const gainCents = holdingGainCents(h);
  const gainPct = holdingGainPct(h);
  return {
    ticker: h.ticker,
    name: h.name,
    account: h.account,
    assetClass: h.assetClass,
    shares: isCash ? null : shareCount.format(h.shares),
    avgCost: isCash ? null : formatMoney(h.avgCostCents),
    price: isCash ? null : formatMoney(h.currentPriceCents),
    value: formatMoney(holdingValueCents(h)),
    gain: isCash ? null : formatSignedMoney(gainCents),
    gainPct: isCash || gainPct === null ? null : formatSignedPct(gainPct),
    tone: isCash ? "flat" : toneOf(gainCents),
  };
}

function toBenchmark(series: BenchmarkPoint[]): BenchmarkView | null {
  const { portfolioReturnPct, veqtReturnPct, outperformancePctPoints } =
    benchmarkComparison(series);
  if (portfolioReturnPct === null || veqtReturnPct === null || outperformancePctPoints === null) {
    return null;
  }
  const portfolioPct = formatSignedPct(portfolioReturnPct);
  const veqtPct = formatSignedPct(veqtReturnPct);
  // outperformancePctPoints is already in points; formatSignedPct expects a fraction.
  const differencePp = formatSignedPct(outperformancePctPoints / 100).replace("%", "pp");
  return {
    summary: `Portfolio ${portfolioPct} vs VEQT ${veqtPct} (${differencePp})`,
    portfolioPct,
    veqtPct,
    differencePp,
    tone: toneOf(outperformancePctPoints),
    headline: benchmarkHeadline(outperformancePctPoints, series[0].month),
    points: indexedBenchmark(series).map((p, i) => ({
      ...p,
      label: formatMonth(p.month),
      portfolioValue: formatMoney(series[i].portfolioValueCents),
      veqtPrice: formatMoney(series[i].veqtPriceCents),
      portfolioChange: formatSignedPct(p.portfolioPct),
      veqtChange: formatSignedPct(p.veqtPct),
    })),
  };
}

export function buildDashboard(
  holdings: Holding[],
  series: BenchmarkPoint[],
  daily: DailyPoint[] = []
): DashboardView {
  const totalCents = portfolioValueCents(holdings);
  const gainCents = portfolioGainCents(holdings);
  const cashCents = holdings
    .filter((h) => h.assetClass === "cash")
    .reduce((sum, h) => sum + holdingValueCents(h), 0);

  const byClass = allocationByAssetClass(holdings);
  const byTicker = allocation(holdings);

  return {
    isEmpty: holdings.length === 0,
    asOf: formatAsOf(holdings[0]?.priceAsOf ?? SEED_AS_OF),
    totals: {
      value: formatMoney(totalCents),
      gain: formatSignedMoney(gainCents),
      gainPct: formatSignedPct(portfolioGainPct(holdings) ?? 0),
      tone: toneOf(gainCents),
      cash: formatMoney(cashCents),
    },
    rows: holdings.map(toRow),
    byAssetClass: ASSET_CLASS_ORDER.filter((c) => byClass[c] !== undefined).map((c) => {
      const share = byClass[c]!;
      return {
        label: ASSET_CLASS_LABELS[c],
        value: formatMoney(
          holdings.filter((h) => h.assetClass === c).reduce((s, h) => s + holdingValueCents(h), 0)
        ),
        pct: formatPct(share),
        share,
      };
    }),
    byHolding: holdings
      .map((h) => ({ ticker: h.ticker, name: h.name, share: byTicker[h.ticker] ?? 0 }))
      .sort((a, b) => b.share - a.share)
      .map((h) => ({ ...h, pct: formatPct(h.share) })),
    benchmark: toBenchmark(series),
    daily: holdings.length === 0 ? [] : daily,
  };
}
