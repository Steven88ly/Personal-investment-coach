import { describe, expect, it } from "vitest";
import { buildDashboard } from "../lib/dashboard";
import type { BenchmarkPoint, DailyPoint, Holding, Transaction } from "../lib/types";
import transactionsSeed from "../data/transactions.seed.json";
import dailySeed from "../data/daily.seed.json";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const holdings = holdingsSeed as Holding[];
const benchmark = benchmarkSeed as BenchmarkPoint[];
const view = buildDashboard(holdings, benchmark);

describe("dashboard view model (seed data)", () => {
  it("summary strip: $19,182.00 total, +$1,572.00 / +8.9% gain, $1,500.00 cash", () => {
    expect(view.isEmpty).toBe(false);
    expect(view.totals.value).toBe("$19,182.00");
    expect(view.totals.gain).toBe("+$1,572.00");
    expect(view.totals.gainPct).toBe("+8.9%");
    expect(view.totals.tone).toBe("gain");
    expect(view.totals.cash).toBe("$1,500.00");
  });

  it("labels prices with their as-of date", () => {
    expect(view.asOf).toBe("Nov 25, 2026");
  });

  it("one row per holding, cash included (7 rows)", () => {
    expect(view.rows.map((r) => r.ticker)).toEqual([
      "VEQT", "XEQT", "VFV", "AAPL", "MSFT", "SHOP", "CASH",
    ]);
  });

  it("VEQT row: 120 shares, $52.00 avg, $57.50 now, $6,900.00, +$660.00 / +10.6%", () => {
    const veqt = view.rows[0];
    expect(veqt).toMatchObject({
      account: "TFSA",
      shares: "120",
      avgCost: "$52.00",
      price: "$57.50",
      value: "$6,900.00",
      gain: "+$660.00",
      gainPct: "+10.6%",
      tone: "gain",
    });
  });

  it("cash row shows only its value, no per-share or gain figures", () => {
    const cash = view.rows.at(-1)!;
    expect(cash).toMatchObject({
      value: "$1,500.00",
      shares: null,
      avgCost: null,
      price: null,
      gain: null,
      gainPct: null,
    });
  });

  it("allocation by asset class: ETFs 59.2%, stocks 33.0%, cash 7.8%", () => {
    expect(view.byAssetClass).toEqual([
      { label: "ETFs", value: "$11,352.00", pct: "59.2%", share: 1135200 / 1918200 },
      { label: "Stocks", value: "$6,330.00", pct: "33.0%", share: 633000 / 1918200 },
      { label: "Cash", value: "$1,500.00", pct: "7.8%", share: 150000 / 1918200 },
    ]);
  });

  it("allocation by holding, largest first, VEQT 36.0%", () => {
    expect(view.byHolding[0]).toMatchObject({ ticker: "VEQT", pct: "36.0%" });
    const shares = view.byHolding.map((h) => h.share);
    expect([...shares].sort((a, b) => b - a)).toEqual(shares);
  });

  it("benchmark summary reads 'Portfolio +11.5% vs VEQT +6.3% (+5.2pp)'", () => {
    expect(view.benchmark?.summary).toBe("Portfolio +11.5% vs VEQT +6.3% (+5.2pp)");
    expect(view.benchmark?.points).toHaveLength(6);
    expect(view.benchmark?.points[0].label).toBe("Jun");
  });

  it("benchmark points carry their dollar figures for the tooltip", () => {
    expect(view.benchmark?.points.at(-1)).toMatchObject({
      portfolioValue: "$19,182.00",
      veqtPrice: "$57.50",
      portfolioChange: "+11.5%",
      veqtChange: "+6.3%",
    });
    expect(view.benchmark?.points[0]).toMatchObject({ portfolioChange: "0.0%", veqtChange: "0.0%" });
  });

  it("benchmark headline says the portfolio is ahead of VEQT", () => {
    expect(view.benchmark?.headline).toBe(
      "You're 5.2 percentage points ahead of VEQT since June."
    );
  });

  it("benchmark headline says behind, or even, when that's the case", () => {
    const behind = buildDashboard(holdings, [
      { month: "2026-06", portfolioValueCents: 100000, veqtPriceCents: 5000 },
      { month: "2026-11", portfolioValueCents: 101000, veqtPriceCents: 5250 },
    ]);
    expect(behind.benchmark?.headline).toBe(
      "You're 4.0 percentage points behind VEQT since June."
    );
    const even = buildDashboard(holdings, [
      { month: "2026-06", portfolioValueCents: 100000, veqtPriceCents: 5000 },
      { month: "2026-11", portfolioValueCents: 105000, veqtPriceCents: 5250 },
    ]);
    expect(even.benchmark?.headline).toBe("You're even with VEQT since June.");
  });
});

describe("dashboard view model (daily series)", () => {
  const daily = dailySeed as DailyPoint[];

  it("passes the daily series through for the hero chart", () => {
    expect(buildDashboard(holdings, benchmark, daily).daily).toHaveLength(124);
  });

  it("has no daily series for an empty portfolio", () => {
    expect(buildDashboard([], benchmark, daily).daily).toEqual([]);
  });
});

describe("dashboard view model (checks, accounts, surplus)", () => {
  const txns = transactionsSeed as Transaction[];
  const full = buildDashboard(holdings, benchmark, [], txns);

  it("carries the three diversification checks", () => {
    expect(full.checks.map((c) => c.id)).toEqual(["single-stock", "stock-share", "cash"]);
  });

  it("carries one summary per account held", () => {
    expect(full.accounts.map((a) => a.account)).toEqual(["TFSA", "RRSP", "non-registered"]);
  });

  it("surplus line: October's leftover, linked to the projector's $200/mo, 7%, 10y case", () => {
    expect(full.surplus).toEqual({
      line: "You had $588.48 left in October ($1,850.00 in, $1,261.52 out). At $200 a month and 7%, that pace of saving grows to $34,616.96 in 10 years.",
      surplusCents: 58848,
    });
  });

  it("a month where spending beat income says so plainly", () => {
    const overspent: Transaction[] = [
      { id: "a", date: "2026-10-01", merchant: "Pay", amountCents: 100000, category: "income", source: "seed" },
      { id: "b", date: "2026-10-02", merchant: "Rent", amountCents: -120000, category: "other", source: "seed" },
    ];
    expect(buildDashboard(holdings, benchmark, [], overspent).surplus?.line).toBe(
      "You spent $200.00 more than you earned in October ($1,000.00 in, $1,200.00 out), so nothing was left to invest."
    );
  });

  it("no transactions for the month means no surplus line", () => {
    expect(buildDashboard(holdings, benchmark).surplus).toBeNull();
  });
});

describe("dashboard view model (empty portfolio)", () => {
  it("is empty with zero totals and no NaN anywhere", () => {
    const empty = buildDashboard([], benchmark);
    expect(empty.isEmpty).toBe(true);
    expect(empty.rows).toEqual([]);
    expect(empty.totals.value).toBe("$0.00");
    expect(empty.totals.gainPct).toBe("0.0%");
    expect(JSON.stringify(empty)).not.toContain("NaN");
  });

  it("has no benchmark when the series is too short to compare", () => {
    expect(buildDashboard(holdings, benchmark.slice(0, 1)).benchmark).toBeNull();
  });
});
