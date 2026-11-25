/**
 * Display formatting. CAD with commas and 2 decimals for money, 1 decimal
 * for percentages (DESIGN.md). Losses use a true minus sign (U+2212) so
 * signed columns line up with tabular numerals.
 */

const MINUS = "−";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cad = new Intl.NumberFormat("en-CA", {
  style: "currency",
  currency: "CAD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export type Tone = "gain" | "loss" | "flat";

export function toneOf(n: number): Tone {
  if (n > 0) return "gain";
  if (n < 0) return "loss";
  return "flat";
}

export function formatMoney(cents: number): string {
  return cad.format(cents / 100);
}

export function formatSignedMoney(cents: number): string {
  if (cents === 0) return formatMoney(0);
  return (cents > 0 ? "+" : MINUS) + formatMoney(Math.abs(cents));
}

export function formatPct(fraction: number): string {
  return `${(fraction * 100).toFixed(1)}%`;
}

export function formatSignedPct(fraction: number): string {
  const rounded = Number((fraction * 100).toFixed(1));
  if (rounded === 0) return "0.0%";
  return `${rounded > 0 ? "+" : MINUS}${Math.abs(rounded).toFixed(1)}%`;
}

/** "2026-11-25" → "Nov 25, 2026". Parsed by hand: no timezone drift. */
export function formatAsOf(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** "2026-06" → "Jun". */
export function formatMonth(yearMonth: string): string {
  return MONTHS[Number(yearMonth.split("-")[1]) - 1];
}

/** A trading day, "2026-08-14" → "Aug 14, 2026" (same shape as the as-of date). */
export const formatDay = formatAsOf;
