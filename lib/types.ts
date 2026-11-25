export type Category =
  | "groceries"
  | "dining"
  | "transit"
  | "subscriptions"
  | "shopping"
  | "entertainment"
  | "health"
  | "income"
  | "other";

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  merchant: string;
  /** Amount in CAD cents. Negative = money out, positive = money in. */
  amountCents: number;
  category: Category | "uncategorized";
  note?: string;
  source: "seed";
}

export type AccountType = "TFSA" | "RRSP" | "FHSA" | "non-registered";
export type AssetClass = "ETF" | "stock" | "cash";

export interface Holding {
  ticker: string;
  name: string;
  shares: number;
  /** Average cost per share, CAD cents. */
  avgCostCents: number;
  /** Current mock price per share, CAD cents. Mock/illustrative data. */
  currentPriceCents: number;
  currency: "CAD";
  account: AccountType;
  assetClass: AssetClass;
  /** Date the mock price is stamped as of. */
  priceAsOf: string; // YYYY-MM-DD
}

export interface BenchmarkPoint {
  month: string; // YYYY-MM
  portfolioValueCents: number;
  veqtPriceCents: number;
}

export interface Budget {
  category: Category;
  capCents: number;
  month: string; // YYYY-MM
}

export interface Goal {
  name: string;
  targetCents: number;
  savedCents: number;
  deadline: string; // YYYY-MM-DD
}

/** One trading day of the generated mock series (data/daily.seed.json). */
export interface DailyPoint {
  date: string; // YYYY-MM-DD
  /** Total portfolio value, CAD cents. Generated mock data. */
  valueCents: number;
}
