import { describe, expect, it } from "vitest";
import {
  allocation,
  benchmarkComparison,
  diversificationFlags,
  holdingGainCents,
  holdingGainPct,
  holdingValueCents,
  portfolioCostCents,
  portfolioGainCents,
  portfolioGainPct,
  portfolioValueCents,
  projectContributions,
} from "../lib/portfolio";
import type { BenchmarkPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const holdings = holdingsSeed as Holding[];
const benchmark = benchmarkSeed as BenchmarkPoint[];

describe("portfolio totals (seed data)", () => {
  it("totals match the verified seed figures", () => {
    expect(portfolioValueCents(holdings)).toBe(1918200); // $19,182.00
    expect(portfolioCostCents(holdings)).toBe(1761000); // $17,610.00
    expect(portfolioGainCents(holdings)).toBe(157200); // $1,572.00
  });

  it("gain percentage is +8.93%", () => {
    expect(portfolioGainPct(holdings)).toBeCloseTo(157200 / 1761000, 4);
  });

  it("VEQT is the biggest holding: $6,900, +$660", () => {
    const veqt = holdings.find((h) => h.ticker === "VEQT")!;
    expect(holdingValueCents(veqt)).toBe(690000);
    expect(holdingGainCents(veqt)).toBe(66000);
    expect(holdingGainPct(veqt)).toBeCloseTo(66000 / 624000, 4);
  });

  it("allocation: VEQT is 36.0% of the portfolio", () => {
    expect(allocation(holdings).VEQT).toBeCloseTo(690000 / 1918200, 4);
  });

  it("empty portfolio returns zeros and nulls, never NaN", () => {
    expect(portfolioValueCents([])).toBe(0);
    expect(portfolioCostCents([])).toBe(0);
    expect(portfolioGainCents([])).toBe(0);
    expect(portfolioGainPct([])).toBeNull();
    expect(allocation([])).toEqual({});
  });
});

describe("benchmark comparison (Jun–Nov 2026)", () => {
  it("portfolio beat VEQT by ~5.2 percentage points", () => {
    const { portfolioReturnPct, veqtReturnPct, outperformancePctPoints } =
      benchmarkComparison(benchmark);
    expect(portfolioReturnPct).toBeCloseTo((1918200 - 1720000) / 1720000, 4);
    expect(veqtReturnPct).toBeCloseTo((5750 - 5410) / 5410, 4);
    expect(outperformancePctPoints).toBeCloseTo(5.24, 1);
  });

  it("a series with fewer than 2 points returns nulls", () => {
    expect(
      benchmarkComparison([benchmark[0]])
    ).toEqual({
      portfolioReturnPct: null,
      veqtReturnPct: null,
      outperformancePctPoints: null,
    });
  });
});

describe("contribution projector", () => {
  it("$200/mo at 7%: $14,318.58 in 5y, $34,616.96 in 10y", () => {
    const five = projectContributions(20000, 7, 5);
    expect(five.futureValueCents).toBe(1431858);
    expect(five.contributedCents).toBe(1200000);
    expect(five.growthCents).toBe(231858);

    const ten = projectContributions(20000, 7, 10);
    expect(ten.futureValueCents).toBe(3461696);
    expect(ten.contributedCents).toBe(2400000);
    expect(ten.growthCents).toBe(1061696);
  });

  it("0% return: future value equals contributions", () => {
    const r = projectContributions(20000, 0, 5);
    expect(r.futureValueCents).toBe(1200000);
    expect(r.growthCents).toBe(0);
  });
});

describe("diversification flags", () => {
  it("does NOT flag VEQT at 36%: ETFs are diversified by construction", () => {
    const flags = diversificationFlags(holdings);
    expect(flags.some((f) => f.startsWith("VEQT"))).toBe(false);
  });

  it("flags a single stock above 25% of the portfolio", () => {
    const concentrated: Holding[] = [
      { ticker: "ACME", name: "Acme Corp", shares: 100, avgCostCents: 10000, currentPriceCents: 10000, currency: "CAD", account: "TFSA", assetClass: "stock", priceAsOf: "2026-11-25" },
      { ticker: "VEQT", name: "Vanguard All-Equity ETF", shares: 10, avgCostCents: 5750, currentPriceCents: 5750, currency: "CAD", account: "TFSA", assetClass: "ETF", priceAsOf: "2026-11-25" },
    ];
    const flags = diversificationFlags(concentrated);
    expect(flags.some((f) => f.startsWith("ACME"))).toBe(true);
  });

  it("seed portfolio raises no flags", () => {
    expect(diversificationFlags(holdings)).toEqual([]);
  });
});
