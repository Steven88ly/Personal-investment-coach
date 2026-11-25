import { formatDay, formatMoney, formatSignedMoney, formatSignedPct, toneOf, type Tone } from "./format";
import type { DailyPoint } from "./types";

/**
 * Math for the scrub hero. Works on the generated mock daily series;
 * the change is value-based, so it includes any money added (not "gain").
 */

export type Range = "1M" | "3M" | "All";
export const RANGES: Range[] = ["1M", "3M", "All"];
export const RANGE_DAYS: Record<Exclude<Range, "All">, number> = { "1M": 21, "3M": 63 };

export function sliceRange(series: DailyPoint[], range: Range): DailyPoint[] {
  if (range === "All") return series;
  return series.slice(-RANGE_DAYS[range]);
}

export interface HeroReadout {
  value: string;
  change: string;
  changePct: string;
  tone: Tone;
  date: string;
  startDate: string;
}

/** Readout at `index` (null = last point), change measured from points[0]. */
export function heroReadout(points: DailyPoint[], index: number | null): HeroReadout {
  const start = points[0];
  const at = points[index ?? points.length - 1];
  const changeCents = at.valueCents - start.valueCents;
  return {
    value: formatMoney(at.valueCents),
    change: formatSignedMoney(changeCents),
    changePct: formatSignedPct(start.valueCents === 0 ? 0 : changeCents / start.valueCents),
    tone: toneOf(changeCents),
    date: formatDay(at.date),
    startDate: formatDay(start.date),
  };
}

const clamp = (i: number, length: number) => Math.min(length - 1, Math.max(0, i));

/** Keyboard scrubbing: arrows step a day, Home/End jump; clamped to the series. */
export function nextIndex(current: number | null, key: string, length: number): number | null {
  const from = current ?? length - 1;
  switch (key) {
    case "ArrowLeft":
      return clamp(from - 1, length);
    case "ArrowRight":
      return clamp(from + 1, length);
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return current;
  }
}

/** Pointer scrubbing: nearest point to x within a plot `width` wide. */
export function indexAtX(x: number, width: number, length: number): number {
  if (length <= 1 || width <= 0) return 0;
  return clamp(Math.round((x / width) * (length - 1)), length);
}
