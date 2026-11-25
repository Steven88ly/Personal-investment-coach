import type { Transaction } from "./types";

/** All money math lives here, server-side, and is covered by tests.
 *  Amounts are integer CAD cents. Spending is negative, income positive. */

export function totalSpent(txns: Transaction[]): number {
  return txns
    .filter((t) => t.amountCents < 0)
    .reduce((sum, t) => sum + t.amountCents, 0);
}

export function totalIncome(txns: Transaction[]): number {
  return txns
    .filter((t) => t.amountCents > 0)
    .reduce((sum, t) => sum + t.amountCents, 0);
}

export function spendByCategory(
  txns: Transaction[]
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of txns) {
    if (t.amountCents >= 0) continue;
    out[t.category] = (out[t.category] ?? 0) + t.amountCents;
  }
  return out;
}

/** Percentage change vs a previous period. Returns null when there is no
 *  previous spend to compare against (avoids divide-by-zero). */
export function monthOverMonth(
  currentCents: number,
  previousCents: number
): number | null {
  if (previousCents === 0) return null;
  return (currentCents - previousCents) / Math.abs(previousCents);
}

export function formatCAD(cents: number): string {
  return (cents / 100).toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
  });
}

/** The last full calendar month before an as-of date: "2026-11-25" → "2026-10". */
export function latestCompleteMonth(asOf: string): string {
  const [y, m] = asOf.split("-").map(Number);
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return `${prevY}-${String(prevM).padStart(2, "0")}`;
}

/** Income minus spending for one month (YYYY-MM). spentCents is positive. */
export function monthlySurplus(
  txns: Transaction[],
  month: string
): { incomeCents: number; spentCents: number; surplusCents: number } {
  const inMonth = txns.filter((t) => t.date.startsWith(month));
  const incomeCents = totalIncome(inMonth);
  const spentCents = Math.abs(totalSpent(inMonth));
  return { incomeCents, spentCents, surplusCents: incomeCents - spentCents };
}
