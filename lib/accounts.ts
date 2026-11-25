import { formatMoney } from "./format";
import { holdingValueCents } from "./portfolio";
import type { AccountType, Holding } from "./types";

/**
 * Account tags (SPEC section 7). Informational only, not tax advice: each
 * line says what the account type is, never what to do with it.
 */

const ORDER: AccountType[] = ["TFSA", "RRSP", "FHSA", "non-registered"];

const ABOUT: Record<AccountType, { name: string; explainer: string }> = {
  TFSA: {
    name: "Tax-Free Savings Account",
    explainer: "Investment growth and withdrawals aren't taxed.",
  },
  RRSP: {
    name: "Registered Retirement Savings Plan",
    explainer: "Contributions can be deducted from taxable income; withdrawals are taxed as income.",
  },
  FHSA: {
    name: "First Home Savings Account",
    explainer: "For saving toward a first home; contributions are deductible and qualifying withdrawals aren't taxed.",
  },
  "non-registered": {
    name: "Non-registered account",
    explainer: "A regular account with no tax shelter; gains and income are taxable.",
  },
};

export interface AccountSummary {
  account: AccountType;
  name: string;
  explainer: string;
  value: string;
  tickers: string[];
}

export function accountSummaries(holdings: Holding[]): AccountSummary[] {
  return ORDER.flatMap((account) => {
    const inAccount = holdings.filter((h) => h.account === account);
    if (inAccount.length === 0) return [];
    return [
      {
        account,
        ...ABOUT[account],
        value: formatMoney(inAccount.reduce((s, h) => s + holdingValueCents(h), 0)),
        tickers: inAccount.map((h) => h.ticker),
      },
    ];
  });
}
