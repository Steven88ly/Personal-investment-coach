import type { AssetClass, BenchmarkPoint, Holding } from "./types";

/**
 * All portfolio math lives here, server-side, and is covered by tests.
 * Amounts are integer CAD cents. Prices in the seed data are MOCK /
 * illustrative, stamped with an "as of" date — never presented as live.
 */

export function holdingValueCents(h: Holding): number {
  return h.shares * h.currentPriceCents;
}

export function holdingCostCents(h: Holding): number {
  return h.shares * h.avgCostCents;
}

export function holdingGainCents(h: Holding): number {
  return holdingValueCents(h) - holdingCostCents(h);
}

export function holdingGainPct(h: Holding): number | null {
  const cost = holdingCostCents(h);
  if (cost === 0) return null;
  return holdingGainCents(h) / cost;
}

export function portfolioValueCents(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + holdingValueCents(h), 0);
}

export function portfolioCostCents(holdings: Holding[]): number {
  return holdings.reduce((sum, h) => sum + holdingCostCents(h), 0);
}

export function portfolioGainCents(holdings: Holding[]): number {
  return portfolioValueCents(holdings) - portfolioCostCents(holdings);
}

export function portfolioGainPct(holdings: Holding[]): number | null {
  const cost = portfolioCostCents(holdings);
  if (cost === 0) return null;
  return portfolioGainCents(holdings) / cost;
}

/** Share of total portfolio value per holding, as a 0–1 fraction. */
export function allocation(holdings: Holding[]): Record<string, number> {
  const total = portfolioValueCents(holdings);
  const out: Record<string, number> = {};
  if (total === 0) return out;
  for (const h of holdings) {
    out[h.ticker] = holdingValueCents(h) / total;
  }
  return out;
}

/** Share of total portfolio value per asset class, as 0–1 fractions. */
export function allocationByAssetClass(
  holdings: Holding[]
): Partial<Record<AssetClass, number>> {
  const total = portfolioValueCents(holdings);
  const out: Partial<Record<AssetClass, number>> = {};
  if (total === 0) return out;
  for (const h of holdings) {
    out[h.assetClass] = (out[h.assetClass] ?? 0) + holdingValueCents(h) / total;
  }
  return out;
}

/** SPEC.md section 4 thresholds, shared by the flags (coach) and the checks (UI). */
export const SINGLE_STOCK_MAX = 0.25;
export const STOCK_SHARE_MAX = 0.4;
export const CASH_MAX = 0.15;

/**
 * Concentration flags with plain-language reasons. No magic risk score —
 * flags with reasons, so the UI can explain each one.
 */
export function diversificationFlags(holdings: Holding[]): string[] {
  const flags: string[] = [];
  const alloc = allocation(holdings);
  const total = portfolioValueCents(holdings);
  // Single-stock concentration only. ETFs are exempt: a broad-market ETF
  // like VEQT can be 36% of a portfolio and still be diversified — flagging
  // it would be wrong, and a reviewer will spot it.
  for (const h of holdings) {
    if (h.assetClass !== "stock") continue;
    if ((alloc[h.ticker] ?? 0) > SINGLE_STOCK_MAX) {
      flags.push(
        `${h.ticker} is ${Math.round((alloc[h.ticker] ?? 0) * 100)}% of your portfolio — above the 25% single-stock watch line.`
      );
    }
  }
  const equities = holdings.filter((h) => h.assetClass === "stock");
  const equityValue = equities.reduce((s, h) => s + holdingValueCents(h), 0);
  for (const h of equities) {
    if (equityValue > 0 && holdingValueCents(h) / equityValue > STOCK_SHARE_MAX) {
      flags.push(
        `${h.ticker} is ${Math.round((holdingValueCents(h) / equityValue) * 100)}% of your individual stocks — one company drives your stock returns.`
      );
    }
  }
  const cash = holdings
    .filter((h) => h.assetClass === "cash")
    .reduce((s, h) => s + holdingValueCents(h), 0);
  if (total > 0 && cash / total > CASH_MAX) {
    flags.push(
      `Cash is ${Math.round((cash / total) * 100)}% of your portfolio — money sitting idle instead of invested.`
    );
  }
  return flags;
}

/**
 * Future value of monthly contributions (end-of-month deposits).
 * FV = P * (((1 + r)^n - 1) / r), r = monthly rate, n = months.
 * The formula is shown in the UI — no black-box numbers.
 */
export function projectContributions(
  monthlyCents: number,
  annualReturnPct: number,
  years: number
): { futureValueCents: number; contributedCents: number; growthCents: number } {
  const r = annualReturnPct / 100 / 12;
  const n = Math.round(years * 12);
  const contributedCents = monthlyCents * n;
  let futureValueCents: number;
  if (r === 0) {
    futureValueCents = contributedCents;
  } else {
    futureValueCents = Math.round(
      monthlyCents * ((Math.pow(1 + r, n) - 1) / r)
    );
  }
  return {
    futureValueCents,
    contributedCents,
    growthCents: futureValueCents - contributedCents,
  };
}

/** Total return of the portfolio vs VEQT over a benchmark series. */
export function benchmarkComparison(series: BenchmarkPoint[]): {
  portfolioReturnPct: number | null;
  veqtReturnPct: number | null;
  outperformancePctPoints: number | null;
} {
  if (series.length < 2) {
    return { portfolioReturnPct: null, veqtReturnPct: null, outperformancePctPoints: null };
  }
  const first = series[0];
  const last = series[series.length - 1];
  if (first.portfolioValueCents === 0 || first.veqtPriceCents === 0) {
    return { portfolioReturnPct: null, veqtReturnPct: null, outperformancePctPoints: null };
  }
  const portfolioReturnPct =
    (last.portfolioValueCents - first.portfolioValueCents) / first.portfolioValueCents;
  const veqtReturnPct =
    (last.veqtPriceCents - first.veqtPriceCents) / first.veqtPriceCents;
  return {
    portfolioReturnPct,
    veqtReturnPct,
    outperformancePctPoints: (portfolioReturnPct - veqtReturnPct) * 100,
  };
}

/**
 * Both series as % change since the first month, so a portfolio value and
 * a share price can share one axis (no dual-axis chart).
 */
export function indexedBenchmark(
  series: BenchmarkPoint[]
): { month: string; portfolioPct: number; veqtPct: number }[] {
  if (series.length === 0) return [];
  const first = series[0];
  if (first.portfolioValueCents === 0 || first.veqtPriceCents === 0) return [];
  return series.map((p) => ({
    month: p.month,
    portfolioPct: (p.portfolioValueCents - first.portfolioValueCents) / first.portfolioValueCents,
    veqtPct: (p.veqtPriceCents - first.veqtPriceCents) / first.veqtPriceCents,
  }));
}

export interface DiversificationCheck {
  id: "single-stock" | "stock-share" | "cash";
  ok: boolean;
  /** One plain-language line: the flag if it fires, otherwise what was checked. */
  line: string;
}

const pct1 = (f: number) => `${(f * 100).toFixed(1)}%`;

/**
 * The three SPEC section 4 checks, each with a one-line read, whether or not
 * it fires: flags with reasons, no risk score. ETFs are exempt from the
 * single-stock rules. Empty portfolio → no checks.
 */
export function diversificationChecks(holdings: Holding[]): DiversificationCheck[] {
  const total = portfolioValueCents(holdings);
  if (total === 0) return [];
  const stocks = holdings
    .filter((h) => h.assetClass === "stock")
    .sort((a, b) => holdingValueCents(b) - holdingValueCents(a));
  const stockTotal = stocks.reduce((s, h) => s + holdingValueCents(h), 0);
  const cashShare =
    holdings.filter((h) => h.assetClass === "cash").reduce((s, h) => s + holdingValueCents(h), 0) / total;

  const noStocks = "You hold no individual stocks, so there is nothing to concentrate.";
  const top = stocks[0];
  const topOfPortfolio = top ? holdingValueCents(top) / total : 0;
  const topOfStocks = top && stockTotal > 0 ? holdingValueCents(top) / stockTotal : 0;

  return [
    {
      id: "single-stock",
      ok: topOfPortfolio <= SINGLE_STOCK_MAX,
      line: !top
        ? noStocks
        : topOfPortfolio > SINGLE_STOCK_MAX
          ? `${top.ticker} is ${pct1(topOfPortfolio)} of your portfolio, above the 25% single-stock watch line.`
          : `No single stock is over 25% of your portfolio. Largest: ${top.ticker} at ${pct1(topOfPortfolio)}.`,
    },
    {
      id: "stock-share",
      ok: topOfStocks <= STOCK_SHARE_MAX,
      line: !top
        ? noStocks
        : topOfStocks > STOCK_SHARE_MAX
          ? `${top.ticker} is ${pct1(topOfStocks)} of your individual stocks, so one company drives your stock returns.`
          : `No stock is over 40% of your individual stocks. Largest: ${top.ticker} at ${pct1(topOfStocks)}.`,
    },
    {
      id: "cash",
      ok: cashShare <= CASH_MAX,
      line:
        cashShare > CASH_MAX
          ? `Cash is ${pct1(cashShare)} of your portfolio, above the 15% line: money sitting idle instead of invested.`
          : `Cash is ${pct1(cashShare)} of your portfolio, under the 15% idle-cash line.`,
    },
  ];
}
