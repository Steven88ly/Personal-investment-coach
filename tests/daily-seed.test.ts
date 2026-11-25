import { describe, expect, it } from "vitest";
import { portfolioValueCents } from "../lib/portfolio";
import type { BenchmarkPoint, DailyPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import dailySeed from "../data/daily.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const daily = dailySeed as DailyPoint[];
const benchmark = benchmarkSeed as BenchmarkPoint[];
const holdings = holdingsSeed as Holding[];

const weekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

describe("daily mock series", () => {
  it("has 124 trading days, Jun 1 to Nov 25, no weekends or TSX holidays", () => {
    expect(daily).toHaveLength(124);
    expect(daily[0].date).toBe("2026-06-01");
    expect(daily.at(-1)!.date).toBe("2026-11-25");
    for (const p of daily) {
      expect([0, 6]).not.toContain(weekday(p.date));
    }
    const dates = daily.map((p) => p.date);
    for (const holiday of ["2026-07-01", "2026-08-03", "2026-09-07", "2026-10-12"]) {
      expect(dates).not.toContain(holiday);
    }
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] > dates[i - 1]).toBe(true);
    }
  });

  it("hits every monthly anchor exactly", () => {
    const anchorDates = ["2026-06-01", "2026-07-31", "2026-08-31", "2026-09-30", "2026-10-30", "2026-11-25"];
    const byDate = new Map(daily.map((p) => [p.date, p.valueCents]));
    anchorDates.forEach((date, i) => {
      expect(byDate.get(date)).toBe(benchmark[i].portfolioValueCents);
    });
  });

  it("last day equals the holdings total", () => {
    expect(daily.at(-1)!.valueCents).toBe(portfolioValueCents(holdings));
  });

  it("values are positive integer cents and daily moves stay under 4%", () => {
    for (let i = 0; i < daily.length; i++) {
      const v = daily[i].valueCents;
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThan(0);
      if (i > 0) {
        const move = Math.abs(v - daily[i - 1].valueCents) / daily[i - 1].valueCents;
        expect(move).toBeLessThan(0.04);
      }
    }
  });
});
