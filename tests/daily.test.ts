import { describe, expect, it } from "vitest";
import { heroReadout, indexAtX, nextIndex, sliceRange } from "../lib/daily";
import type { DailyPoint } from "../lib/types";
import dailySeed from "../data/daily.seed.json";

const seed = dailySeed as DailyPoint[];
const MINUS = "−";

describe("sliceRange", () => {
  it("1M is the last 21 trading days, ending Nov 25", () => {
    const r = sliceRange(seed, "1M");
    expect(r).toHaveLength(21);
    expect(r.at(-1)!.date).toBe("2026-11-25");
  });

  it("3M is the last 63, All is everything", () => {
    expect(sliceRange(seed, "3M")).toHaveLength(63);
    expect(sliceRange(seed, "All")).toHaveLength(124);
  });

  it("a series shorter than the range returns all of it", () => {
    expect(sliceRange(seed.slice(0, 10), "3M")).toHaveLength(10);
  });
});

describe("heroReadout", () => {
  it("All range, not scrubbing: Nov 25 value and change since Jun 1", () => {
    expect(heroReadout(sliceRange(seed, "All"), null)).toEqual({
      value: "$19,182.00",
      change: "+$1,982.00",
      changePct: "+11.5%",
      tone: "gain",
      date: "Nov 25, 2026",
      startDate: "Jun 1, 2026",
    });
  });

  it("at the first point the change is zero", () => {
    const r = heroReadout(seed, 0);
    expect(r.change).toBe("$0.00");
    expect(r.date).toBe("Jun 1, 2026");
  });

  it("a fall reads as a loss", () => {
    const r = heroReadout(
      [
        { date: "2026-11-24", valueCents: 1000 },
        { date: "2026-11-25", valueCents: 900 },
      ],
      null
    );
    expect(r.tone).toBe("loss");
    expect(r.change).toBe(`${MINUS}$1.00`);
  });

  it("no change reads as flat", () => {
    const r = heroReadout(
      [
        { date: "2026-11-24", valueCents: 1000 },
        { date: "2026-11-25", valueCents: 1000 },
      ],
      null
    );
    expect(r).toMatchObject({ tone: "flat", change: "$0.00", changePct: "0.0%" });
  });
});

describe("nextIndex (keyboard scrubbing)", () => {
  it("starts from the last point when not scrubbing", () => {
    expect(nextIndex(null, "ArrowLeft", 10)).toBe(8);
  });

  it("clamps at both ends", () => {
    expect(nextIndex(0, "ArrowLeft", 10)).toBe(0);
    expect(nextIndex(9, "ArrowRight", 10)).toBe(9);
  });

  it("Home and End jump to the ends; other keys change nothing", () => {
    expect(nextIndex(4, "Home", 10)).toBe(0);
    expect(nextIndex(4, "End", 10)).toBe(9);
    expect(nextIndex(4, "a", 10)).toBe(4);
  });
});

describe("indexAtX (pointer scrubbing)", () => {
  it("clamps outside the plot", () => {
    expect(indexAtX(-50, 600, 10)).toBe(0);
    expect(indexAtX(650, 600, 10)).toBe(9);
  });

  it("picks the nearest point", () => {
    expect(indexAtX(300, 600, 11)).toBe(5);
  });
});
