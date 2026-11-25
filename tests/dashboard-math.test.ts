import { describe, expect, it } from "vitest";
import { allocationByAssetClass, indexedBenchmark } from "../lib/portfolio";
import type { BenchmarkPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const holdings = holdingsSeed as Holding[];
const benchmark = benchmarkSeed as BenchmarkPoint[];

describe("allocation by asset class (seed data)", () => {
  it("ETFs $11,352, stocks $6,330, cash $1,500 of $19,182", () => {
    const a = allocationByAssetClass(holdings);
    expect(a.ETF).toBeCloseTo(1135200 / 1918200, 6);
    expect(a.stock).toBeCloseTo(633000 / 1918200, 6);
    expect(a.cash).toBeCloseTo(150000 / 1918200, 6);
  });

  it("shares sum to 1", () => {
    const a = allocationByAssetClass(holdings);
    expect((a.ETF ?? 0) + (a.stock ?? 0) + (a.cash ?? 0)).toBeCloseTo(1, 10);
  });

  it("empty portfolio returns an empty object, never NaN", () => {
    expect(allocationByAssetClass([])).toEqual({});
  });
});

describe("indexed benchmark series (% change since the first month)", () => {
  it("starts both lines at 0 in June", () => {
    const s = indexedBenchmark(benchmark);
    expect(s[0]).toEqual({ month: "2026-06", portfolioPct: 0, veqtPct: 0 });
  });

  it("ends at portfolio +11.5% and VEQT +6.3% in November", () => {
    const last = indexedBenchmark(benchmark).at(-1)!;
    expect(last.month).toBe("2026-11");
    expect(last.portfolioPct).toBeCloseTo((1918200 - 1720000) / 1720000, 6);
    expect(last.veqtPct).toBeCloseTo((5750 - 5410) / 5410, 6);
  });

  it("returns one point per month", () => {
    expect(indexedBenchmark(benchmark)).toHaveLength(6);
  });

  it("returns [] for an empty series or a zero starting value", () => {
    expect(indexedBenchmark([])).toEqual([]);
    expect(
      indexedBenchmark([{ month: "2026-06", portfolioValueCents: 0, veqtPriceCents: 5410 }])
    ).toEqual([]);
  });
});
