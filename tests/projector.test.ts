import { describe, expect, it } from "vitest";
import { PROJECTOR_DEFAULTS, clampProjectorInput, projectionView } from "../lib/projector";

describe("projector defaults", () => {
  it("start at $200/mo, 7%, 10 years (SPEC acceptance case)", () => {
    expect(PROJECTOR_DEFAULTS).toEqual({ monthly: 200, ratePct: 7, years: 10 });
  });
});

describe("projectionView: $200/mo at 7%", () => {
  const ten = projectionView(20000, 7, 10);

  it("10 years: $34,616.96, of which $24,000.00 deposits and $10,616.96 growth", () => {
    expect(ten.futureValue).toBe("$34,616.96");
    expect(ten.contributed).toBe("$24,000.00");
    expect(ten.growth).toBe("$10,616.96");
    expect(ten.growthShare).toBeCloseTo(1061696 / 3461696, 6);
  });

  it("also reports the 5- and 10-year marks", () => {
    expect(ten.milestones).toEqual([
      { years: 5, value: "$14,318.58" },
      { years: 10, value: "$34,616.96" },
    ]);
  });

  it("shows the formula with the actual numbers plugged in", () => {
    expect(ten.formula).toBe("FV = P × ((1 + r)ⁿ − 1) ÷ r");
    expect(ten.terms).toEqual([
      "P = $200.00 deposited at the end of each month",
      "r = 7% ÷ 12 = 0.5833% a month",
      "n = 10 years × 12 = 120 months",
    ]);
  });
});

describe("projectionView: edge cases", () => {
  it("0% return: value equals deposits, no growth, and says why", () => {
    const v = projectionView(20000, 0, 5);
    expect(v.futureValue).toBe("$12,000.00");
    expect(v.growth).toBe("$0.00");
    expect(v.growthShare).toBe(0);
    expect(v.terms[1]).toBe("r = 0% a month, so the value is just the deposits");
  });

  it("$0/mo: everything is zero and nothing is NaN", () => {
    const v = projectionView(0, 7, 10);
    expect(v.futureValue).toBe("$0.00");
    expect(v.growthShare).toBe(0);
    expect(JSON.stringify(v)).not.toContain("NaN");
  });

  it("horizons under 5 years only list the marks that fit", () => {
    expect(projectionView(20000, 7, 3).milestones.map((m) => m.years)).toEqual([3]);
    expect(projectionView(20000, 7, 7).milestones.map((m) => m.years)).toEqual([5, 7]);
  });
});

describe("clampProjectorInput (sliders and number fields)", () => {
  it("keeps values inside the allowed ranges", () => {
    expect(clampProjectorInput({ monthly: -50, ratePct: 40, years: 0 })).toEqual({ monthly: 0, ratePct: 15, years: 1 });
    expect(clampProjectorInput({ monthly: 999999, ratePct: -3, years: 90 })).toEqual({ monthly: 5000, ratePct: 0, years: 50 });
  });

  it("an empty or invalid field falls back to the minimum, never NaN", () => {
    expect(clampProjectorInput({ monthly: Number.NaN, ratePct: Number.NaN, years: Number.NaN })).toEqual({
      monthly: 0,
      ratePct: 0,
      years: 1,
    });
  });

  it("years are whole numbers", () => {
    expect(clampProjectorInput({ monthly: 200, ratePct: 7, years: 10.6 }).years).toBe(11);
  });
});
