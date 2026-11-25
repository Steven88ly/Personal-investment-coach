import { describe, expect, it } from "vitest";
import { TOOL_DEFS, executeTool, validateArgs } from "../lib/tools";
import type { BenchmarkPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const ctx = { holdings: holdingsSeed as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };
const empty = { holdings: [] as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };

describe("tool allowlist (AGENT.md §3)", () => {
  it("exposes exactly the six read-only tools, each with a description", () => {
    expect(TOOL_DEFS.map((t) => t.name).sort()).toEqual([
      "getAllocation",
      "getBenchmarkComparison",
      "getDiversificationFlags",
      "getHoldings",
      "getPortfolioSummary",
      "projectContributions",
    ]);
    for (const t of TOOL_DEFS) expect(t.description.length).toBeGreaterThan(40);
  });
});

describe("validateArgs", () => {
  it("accepts valid projector args", () => {
    expect(validateArgs("projectContributions", { monthlyCents: 20000, annualReturnPct: 7, years: 10 })).toEqual({
      ok: true,
      args: { monthlyCents: 20000, annualReturnPct: 7, years: 10 },
    });
  });

  it("rejects a missing required field, a wrong type, and an out-of-range value", () => {
    expect(validateArgs("projectContributions", { monthlyCents: 20000, years: 10 }).ok).toBe(false);
    expect(validateArgs("projectContributions", { monthlyCents: "200", annualReturnPct: 7, years: 10 }).ok).toBe(false);
    expect(validateArgs("projectContributions", { monthlyCents: 20000, annualReturnPct: 7, years: 99 }).ok).toBe(false);
    expect(validateArgs("projectContributions", { monthlyCents: 200.5, annualReturnPct: 7, years: 10 }).ok).toBe(false);
  });

  it("rejects an enum value that isn't allowed, and unknown fields", () => {
    expect(validateArgs("getHoldings", { account: "LIRA" }).ok).toBe(false);
    expect(validateArgs("getPortfolioSummary", { userId: "x" }).ok).toBe(false);
  });

  it("rejects an unknown tool, and says why", () => {
    const r = validateArgs("placeTrade", {});
    expect(r).toEqual({ ok: false, error: 'Unknown tool "placeTrade". Available: getPortfolioSummary, getHoldings, getAllocation, getBenchmarkComparison, getDiversificationFlags, projectContributions.' });
  });
});

describe("executeTool on the seed portfolio", () => {
  it("getPortfolioSummary: $19,182.00 value, +$1,572.00 / +8.93% gain", () => {
    expect(executeTool("getPortfolioSummary", {}, ctx)).toEqual({
      holdingsCount: 7,
      totalValue: "$19,182.00",
      totalCost: "$17,610.00",
      gain: "+$1,572.00",
      gainPct: "+8.93%",
      cash: "$1,500.00",
      cashSharePct: "7.82%",
      pricesAsOf: "Nov 25, 2026 (mock data)",
    });
  });

  it("getHoldings filters by account and caps at 10", () => {
    const r = executeTool("getHoldings", { account: "TFSA" }, ctx) as { holdings: { ticker: string }[] };
    expect(r.holdings.map((h) => h.ticker)).toEqual(["VEQT", "XEQT", "SHOP"]);
    expect((executeTool("getHoldings", {}, ctx) as { holdings: unknown[] }).holdings.length).toBeLessThanOrEqual(10);
  });

  it("getHoldings rows carry formatted value, gain and share", () => {
    const r = executeTool("getHoldings", { assetClass: "ETF" }, ctx) as { holdings: Record<string, string>[] };
    expect(r.holdings[0]).toMatchObject({
      ticker: "VEQT",
      account: "TFSA",
      value: "$6,900.00",
      gain: "+$660.00",
      gainPct: "+10.58%",
      shareOfPortfolioPct: "35.97%",
    });
  });

  it("getAllocation: largest first, VEQT 35.97%", () => {
    const r = executeTool("getAllocation", {}, ctx) as { byHolding: { ticker: string; sharePct: string }[] };
    expect(r.byHolding[0]).toEqual({ ticker: "VEQT", sharePct: "35.97%", value: "$6,900.00" });
  });

  it("getBenchmarkComparison: +11.52% vs +6.28%, +5.24pp", () => {
    expect(executeTool("getBenchmarkComparison", {}, ctx)).toEqual({
      period: "Jun 2026 to Nov 2026 (mock data)",
      portfolioReturnPct: "+11.52%",
      veqtReturnPct: "+6.28%",
      differencePp: "+5.24pp",
    });
  });

  it("getDiversificationFlags: none on the seed, with the checks spelled out", () => {
    const r = executeTool("getDiversificationFlags", {}, ctx) as { flags: string[]; checks: string[] };
    expect(r.flags).toEqual([]);
    expect(r.checks).toHaveLength(3);
  });

  it("projectContributions: $200/mo, 7%, 10y → $34,616.96", () => {
    expect(executeTool("projectContributions", { monthlyCents: 20000, annualReturnPct: 7, years: 10 }, ctx)).toEqual({
      monthly: "$200.00",
      annualReturnPct: "7%",
      years: 10,
      futureValue: "$34,616.96",
      contributed: "$24,000.00",
      growth: "$10,616.96",
      formula: "FV = P × ((1 + r)^n − 1) / r, r = annual rate / 12, n = years × 12",
    });
  });
});

describe("executeTool on an empty portfolio", () => {
  it("reports no holdings instead of dividing by zero", () => {
    const summary = executeTool("getPortfolioSummary", {}, empty);
    expect(summary).toEqual({ holdingsCount: 0, note: "No holdings in this portfolio." });
    expect(JSON.stringify(executeTool("getAllocation", {}, empty))).not.toContain("NaN");
  });
});
