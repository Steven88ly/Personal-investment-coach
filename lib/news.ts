import { formatAsOf, formatDay, formatMoney, formatPct } from "./format";
import { holdingValueCents, portfolioValueCents } from "./portfolio";
import type { Holding, NewsItem, SentimentLabel } from "./types";

export type SentimentTone = "bullish" | "bearish" | "neutral";

/** Colour family for a sentiment label: the two bullish labels, the two bearish, or neutral. */
export function sentimentTone(label: SentimentLabel): SentimentTone {
  if (label.endsWith("Bullish")) return "bullish";
  if (label.endsWith("Bearish")) return "bearish";
  return "neutral";
}

/**
 * Neutral news digest (docs/superpowers/specs/2026-11-25-neutral-news-digest-design.md).
 * Facts, sources, dates, and exposure arithmetic. Never sentiment, impact,
 * predictions, or suggestions. No model writes any of this text.
 */

/** Evaluative or directional words the digest and the coach's news answers must not use. */
export const NON_NEUTRAL_TERMS = [
  "good", "bad", "positive", "negative", "bullish", "bearish", "opportunity",
  "worry", "worrying", "concern", "concerning", "risky", "should", "buy", "sell",
  "hold", "recommend", "beat", "miss", "strong", "weak", "upside", "downside",
  // Impact language: a story touches holdings; saying it affects them is a prediction.
  "affect", "affects", "affected", "impact", "impacts", "impacted",
];

const NON_NEUTRAL_RE = new RegExp(String.raw`\b(${NON_NEUTRAL_TERMS.join("|")})\b`, "i");

/** The first non-neutral term in the text (lower case), or null. Strict: for story text. */
export function containsNonNeutral(text: string): string | null {
  return text.match(NON_NEUTRAL_RE)?.[1].toLowerCase() ?? null;
}

// Coach answers may say "you hold AAPL": ordinary exposure wording, not advice.
const ANSWER_TERMS = NON_NEUTRAL_TERMS.filter((t) => t !== "hold");
const ANSWER_RE = new RegExp(String.raw`\b(${ANSWER_TERMS.join("|")})\b`, "i");

/** Like containsNonNeutral, but for coach answers ("hold" allowed). */
export function containsNonNeutralAnswer(text: string): string | null {
  return text.match(ANSWER_RE)?.[1].toLowerCase() ?? null;
}

/** The seam: mock stories now, a live feed (Finnhub) later. */
export interface NewsProvider {
  stories(): NewsItem[];
  source: "mock";
}

export class MockNewsProvider implements NewsProvider {
  readonly source = "mock" as const;
  constructor(private readonly items: NewsItem[]) {}
  stories(): NewsItem[] {
    return this.items;
  }
}

export const MAX_MARKET_STORIES = 3;
export const MAX_STORIES_PER_HOLDING = 2;

/** Held, non-cash holdings, largest first. */
function invested(holdings: Holding[]): Holding[] {
  return holdings
    .filter((h) => h.assetClass !== "cash")
    .sort((a, b) => holdingValueCents(b) - holdingValueCents(a));
}

/** "AAPL is 10.8% of your portfolio ($2,080.00), non-registered account." */
export function holdingExposure(ticker: string, holdings: Holding[]): string | null {
  const h = invested(holdings).find((x) => x.ticker === ticker);
  if (!h) return null;
  const value = holdingValueCents(h);
  return `${h.ticker} is ${formatPct(value / portfolioValueCents(holdings))} of your portfolio (${formatMoney(value)}), ${h.account} account.`;
}

/** "Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00)." Held tickers only. */
export function groupExposure(tickers: string[], holdings: Holding[]): string | null {
  const touched = invested(holdings).filter((h) => tickers.includes(h.ticker));
  if (touched.length === 0) return null;
  const value = touched.reduce((s, h) => s + holdingValueCents(h), 0);
  return `Touches ${touched.map((h) => h.ticker).join(", ")}: ${formatPct(value / portfolioValueCents(holdings))} of your portfolio (${formatMoney(value)}).`;
}

export interface StoryView {
  id: string;
  title: string;
  summary: string;
  source: string;
  date: string;
  sample: boolean;
  keyPoints: string[];
  upcoming?: { date: string; label: string; sample: boolean };
  /** Market stories only: which of your holdings it touches, and how much. */
  touches?: string;
  /** Attributed rating for the panel; tools strip it so the coach stays neutral. */
  sentiment?: { label: SentimentLabel; source: string; tone: SentimentTone };
}

export interface Digest {
  asOf: string;
  market: StoryView[];
  cards: { ticker: string; name: string; exposure: string; stories: StoryView[] }[];
  /** "No stories this period for MSFT." — or null when every holding has news. */
  quiet: string | null;
}

const newestFirst = (a: NewsItem, b: NewsItem) => b.publishedAt.localeCompare(a.publishedAt) || a.id.localeCompare(b.id);

function toView(n: NewsItem, touches?: string): StoryView {
  return {
    id: n.id,
    title: n.title,
    summary: n.summary,
    source: n.source,
    date: formatDay(n.publishedAt),
    sample: n.sample,
    keyPoints: n.keyPoints,
    ...(n.upcoming ? { upcoming: { ...n.upcoming, date: formatDay(n.upcoming.date) } } : {}),
    ...(touches ? { touches } : {}),
    ...(n.sentiment ? { sentiment: { ...n.sentiment, tone: sentimentTone(n.sentiment.label) } } : {}),
  };
}

export function buildDigest(holdings: Holding[], stories: NewsItem[]): Digest | null {
  if (holdings.length === 0) return null;
  const held = invested(holdings);
  const sorted = [...stories].sort(newestFirst);

  const market = sorted
    .filter((n) => n.scope === "market")
    .map((n) => ({ n, touches: groupExposure(n.tickers, holdings) }))
    .filter((x): x is { n: NewsItem; touches: string } => x.touches !== null)
    .slice(0, MAX_MARKET_STORIES);

  const cards = held.flatMap((h) => {
    const own = sorted.filter((n) => n.scope === "holding" && n.tickers.includes(h.ticker)).slice(0, MAX_STORIES_PER_HOLDING);
    if (own.length === 0) return [];
    return [{ ticker: h.ticker, name: h.name, exposure: holdingExposure(h.ticker, holdings)!, stories: own.map((n) => toView(n)) }];
  });

  const covered = new Set([...market.flatMap((x) => x.n.tickers), ...cards.map((c) => c.ticker)]);
  const quiet = held.filter((h) => !covered.has(h.ticker)).map((h) => h.ticker);

  return {
    asOf: formatAsOf(holdings[0].priceAsOf),
    market: market.map((x) => toView(x.n, x.touches)),
    cards,
    quiet: quiet.length > 0 ? `No stories this period for ${quiet.join(", ")}.` : null,
  };
}
