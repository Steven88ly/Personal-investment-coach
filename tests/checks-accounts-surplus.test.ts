import { describe, expect, it } from "vitest";
import { accountSummaries } from "../lib/accounts";
import { latestCompleteMonth, monthlySurplus } from "../lib/money";
import { diversificationChecks, diversificationFlags } from "../lib/portfolio";
import type { Holding, Transaction } from "../lib/types";
import holdingsSeed from "../data/holdings.seed.json";
import transactionsSeed from "../data/transactions.seed.json";

const holdings = holdingsSeed as Holding[];
const txns = transactionsSeed as Transaction[];

const stock = (ticker: string, dollars: number): Holding => ({
  ticker, name: ticker, shares: 1, avgCostCents: dollars * 100, currentPriceCents: dollars * 100,
  currency: "CAD", account: "TFSA", assetClass: "stock", priceAsOf: "2026-11-25",
});
const etf = (ticker: string, dollars: number): Holding => ({ ...stock(ticker, dollars), assetClass: "ETF" });
const cash = (dollars: number): Holding => ({ ...stock("CASH", dollars), assetClass: "cash", account: "non-registered" });

describe("diversificationChecks (seed: nothing fires)", () => {
  const checks = diversificationChecks(holdings);

  it("runs all three checks, all clear, each naming the actual figure", () => {
    expect(checks).toEqual([
      { id: "single-stock", ok: true, line: "No single stock is over 25% of your portfolio. Largest: MSFT at 12.5%." },
      { id: "stock-share", ok: true, line: "No stock is over 40% of your individual stocks. Largest: MSFT at 37.9%." },
      { id: "cash", ok: true, line: "Cash is 7.8% of your portfolio, under the 15% idle-cash line." },
    ]);
  });

  it("agrees with diversificationFlags: no flags on the seed", () => {
    expect(diversificationFlags(holdings)).toEqual([]);
  });
});

describe("diversificationChecks (concentrated portfolio)", () => {
  it("flags a stock over 25% of the portfolio and over 40% of stocks, in plain language", () => {
    const checks = diversificationChecks([stock("ACME", 6000), stock("BETA", 1000), etf("VEQT", 3000)]);
    expect(checks[0]).toEqual({
      id: "single-stock",
      ok: false,
      line: "ACME is 60.0% of your portfolio, above the 25% single-stock watch line.",
    });
    expect(checks[1]).toEqual({
      id: "stock-share",
      ok: false,
      line: "ACME is 85.7% of your individual stocks, so one company drives your stock returns.",
    });
  });

  it("flags cash over 15%", () => {
    expect(diversificationChecks([etf("VEQT", 800), cash(200)])[2]).toEqual({
      id: "cash",
      ok: false,
      line: "Cash is 20.0% of your portfolio, above the 15% line: money sitting idle instead of invested.",
    });
  });

  it("never flags an ETF, however large", () => {
    const checks = diversificationChecks([etf("VEQT", 9000), cash(1000)]);
    expect(checks[0]).toEqual({ id: "single-stock", ok: true, line: "You hold no individual stocks, so there is nothing to concentrate." });
    expect(checks[1]).toEqual({ id: "stock-share", ok: true, line: "You hold no individual stocks, so there is nothing to concentrate." });
  });

  it("an empty portfolio returns no checks", () => {
    expect(diversificationChecks([])).toEqual([]);
  });
});

describe("accountSummaries", () => {
  it("one line per account held, in TFSA / RRSP / FHSA / non-registered order", () => {
    const accounts = accountSummaries(holdings);
    expect(accounts.map((a) => [a.account, a.value, a.tickers])).toEqual([
      ["TFSA", "$10,922.00", ["VEQT", "XEQT", "SHOP"]],
      ["RRSP", "$2,280.00", ["VFV"]],
      ["non-registered", "$5,980.00", ["AAPL", "MSFT", "CASH"]],
    ]);
  });

  it("explains each tag in plain language", () => {
    const byAccount = Object.fromEntries(accountSummaries(holdings).map((a) => [a.account, a]));
    expect(byAccount.TFSA.name).toBe("Tax-Free Savings Account");
    expect(byAccount.TFSA.explainer).toMatch(/aren't taxed/);
    expect(byAccount.RRSP.explainer).toMatch(/taxed as income/);
    expect(byAccount["non-registered"].explainer).toMatch(/taxable/);
  });

  it("includes FHSA when held", () => {
    const fhsa = { ...etf("XEQT", 500), account: "FHSA" as const };
    const accounts = accountSummaries([fhsa]);
    expect(accounts).toHaveLength(1);
    expect(accounts[0]).toMatchObject({ account: "FHSA", name: "First Home Savings Account", value: "$500.00" });
  });
});

describe("investable surplus", () => {
  it("the latest complete month before Nov 25, 2026 is October", () => {
    expect(latestCompleteMonth("2026-11-25")).toBe("2026-10");
    expect(latestCompleteMonth("2026-01-03")).toBe("2025-12");
  });

  it("October: $1,850.00 in, $1,261.52 out, $588.48 left", () => {
    expect(monthlySurplus(txns, "2026-10")).toEqual({
      incomeCents: 185000,
      spentCents: 126152,
      surplusCents: 58848,
    });
  });

  it("a month with no transactions is all zeros", () => {
    expect(monthlySurplus(txns, "2026-05")).toEqual({ incomeCents: 0, spentCents: 0, surplusCents: 0 });
  });
});
