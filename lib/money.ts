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
