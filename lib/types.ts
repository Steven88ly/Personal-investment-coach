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

/**
 * A news story for the neutral digest (data/news.seed.json now, a live feed
 * later). Facts only: no sentiment, no recommendation.
 */
export interface NewsItem {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string; // YYYY-MM-DD
  /** Tickers the story is about (held or not). */
  tickers: string[];
  /** true = illustrative stand-in, shown with a "Sample" label. */
  sample: boolean;
  scope: "market" | "holding";
  /** 1–3 factual lines. */
  keyPoints: string[];
  upcoming?: { date: string; label: string; sample: boolean };
  /** Attributed sentiment rating (Alpha Vantage's scale). Shown in the panel only. */
  sentiment?: { label: SentimentLabel; source: string };
}

export type SentimentLabel = "Bearish" | "Somewhat-Bearish" | "Neutral" | "Somewhat-Bullish" | "Bullish";
