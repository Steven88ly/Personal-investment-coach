import type { Category, Transaction } from "./types";

/**
 * Rule-based categorizer — runs BEFORE any AI fallback.
 * Every match is explainable: the returned reason names the rule.
 * Unknown merchants stay "uncategorized" and surface for review;
 * they are never silently guessed.
 */
const RULES: { match: RegExp; category: Category; reason: string }[] = [
  { match: /iga|metro|provigo|walmart|superc/i, category: "groceries", reason: "grocery merchant" },
  { match: /tim hortons|starbucks|café|cafe|restaurant|mcdonald|burger|pizza|sushi|bistro/i, category: "dining", reason: "food/dining merchant" },
  { match: /stm|uber|lyft|taxi|metro transit|op us/i, category: "transit", reason: "transit merchant" },
  { match: /netflix|spotify|disney|apple\.com\/bill|amazon prime|gym|goodlife/i, category: "subscriptions", reason: "subscription merchant" },
  { match: /amazon|ebay|shein|zara|h&m|uniqlo|dollarama|canadian tire/i, category: "shopping", reason: "retail merchant" },
  { match: /cineplex|ticket|concert|steam|playstation|xbox/i, category: "entertainment", reason: "entertainment merchant" },
  { match: /pharmacy|jean coutu|doctor|dentist|clinic/i, category: "health", reason: "health merchant" },
  { match: /payroll|e-transfer received|employer|internship pay/i, category: "income", reason: "income source" },
];

export function categorize(
  txn: Transaction
): { category: Category | "uncategorized"; reason: string } {
  for (const rule of RULES) {
    if (rule.match.test(txn.merchant)) {
      return { category: rule.category, reason: rule.reason };
    }
  }
  return { category: "uncategorized", reason: "no rule matched — needs review" };
}
