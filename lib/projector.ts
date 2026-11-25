import { formatMoney } from "./format";
import { projectContributions } from "./portfolio";

/**
 * View model for the contribution projector. The math is
 * projectContributions (tested in portfolio.test.ts); this formats it and
 * spells out the formula with the user's numbers, so nothing is a black box.
 * Pure, so the interactive panel can recompute as sliders move.
 */

export interface ProjectorInput {
  /** Dollars per month. */
  monthly: number;
  ratePct: number;
  years: number;
}

export const PROJECTOR_DEFAULTS: ProjectorInput = { monthly: 200, ratePct: 7, years: 10 };

export const PROJECTOR_LIMITS = {
  monthly: { min: 0, max: 5000, step: 25 },
  ratePct: { min: 0, max: 15, step: 0.5 },
  years: { min: 1, max: 50, step: 1 },
} as const;

const clamp = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;

export function clampProjectorInput(input: ProjectorInput): ProjectorInput {
  const L = PROJECTOR_LIMITS;
  return {
    monthly: clamp(input.monthly, L.monthly.min, L.monthly.max),
    ratePct: Math.round(clamp(input.ratePct, L.ratePct.min, L.ratePct.max) * 10) / 10,
    years: Math.round(clamp(input.years, L.years.min, L.years.max)),
  };
}

export interface ProjectionView {
  futureValue: string;
  contributed: string;
  growth: string;
  /** Growth as a 0–1 share of the future value, for the split bar. */
  growthShare: number;
  milestones: { years: number; value: string }[];
  formula: string;
  terms: string[];
}

const pctLabel = (n: number) => `${Number(n.toFixed(1))}%`;

export function projectionView(monthlyCents: number, ratePct: number, years: number): ProjectionView {
  const result = projectContributions(monthlyCents, ratePct, years);
  // The 5- and 10-year marks the spec asks for, then the chosen horizon.
  const marks = [5, 10].filter((y) => y < years).concat(years);
  return {
    futureValue: formatMoney(result.futureValueCents),
    contributed: formatMoney(result.contributedCents),
    growth: formatMoney(result.growthCents),
    growthShare: result.futureValueCents > 0 ? result.growthCents / result.futureValueCents : 0,
    milestones: marks.map((y) => ({ years: y, value: formatMoney(projectContributions(monthlyCents, ratePct, y).futureValueCents) })),
    formula: "FV = P × ((1 + r)ⁿ − 1) ÷ r",
    terms: [
      `P = ${formatMoney(monthlyCents)} deposited at the end of each month`,
      ratePct === 0
        ? "r = 0% a month, so the value is just the deposits"
        : `r = ${pctLabel(ratePct)} ÷ 12 = ${(ratePct / 12).toFixed(4)}% a month`,
      `n = ${years} years × 12 = ${years * 12} months`,
    ],
  };
}
