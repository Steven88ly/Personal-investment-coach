import { describe, expect, it } from "vitest";
import {
  formatCAD,
  monthOverMonth,
  spendByCategory,
  totalIncome,
  totalSpent,
} from "../lib/money";
import type { Transaction } from "../lib/types";
import transactionsSeed from "../data/transactions.seed.json";

const txns = transactionsSeed as Transaction[];

describe("transaction totals (seed data)", () => {
  it("55 transactions: $2,204.53 spent vs $3,700.00 income", () => {
    expect(txns).toHaveLength(55);
    expect(totalSpent(txns)).toBe(-220453);
    expect(totalIncome(txns)).toBe(370000);
  });

  it("spending by category matches the verified breakdown", () => {
    const byCat = spendByCategory(txns);
    expect(byCat.groceries).toBe(-76335);
    expect(byCat.shopping).toBe(-53707);
    expect(byCat.transit).toBe(-42615);
    expect(byCat.entertainment).toBe(-14788);
    expect(byCat.dining).toBe(-14495);
    expect(byCat.subscriptions).toBe(-14193);
    expect(byCat.health).toBe(-4320);
  });

  it("income is excluded from spending totals", () => {
    expect(spendByCategory(txns).income).toBeUndefined();
  });

  it("empty input returns zeros", () => {
    expect(totalSpent([])).toBe(0);
    expect(totalIncome([])).toBe(0);
    expect(spendByCategory([])).toEqual({});
  });
});

describe("month-over-month", () => {
  it("computes the change vs the previous period", () => {
    expect(monthOverMonth(10000, 8000)).toBeCloseTo(0.25, 4);
  });

  it("returns null when there is no previous spend (no divide-by-zero)", () => {
    expect(monthOverMonth(10000, 0)).toBeNull();
  });
});

describe("formatCAD", () => {
  it("formats cents as Canadian dollars", () => {
    expect(formatCAD(-220453)).toContain("2,204.53");
    expect(formatCAD(0)).toContain("0.00");
  });
});
