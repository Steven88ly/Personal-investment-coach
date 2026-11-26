import { describe, expect, it } from "vitest";
import { MockNewsProvider, buildDigest, groupExposure, holdingExposure } from "../lib/news";
import type { Holding, NewsItem } from "../lib/types";
import holdingsSeed from "../data/holdings.seed.json";
import newsSeed from "../data/news.seed.json";

const holdings = holdingsSeed as Holding[];
const news = newsSeed as NewsItem[];

const story = (over: Partial<NewsItem>): NewsItem => ({
  id: "x",
  title: "Title",
  summary: "Summary",
  source: "Source",
  publishedAt: "2026-11-01",
  tickers: [],
  sample: false,
  scope: "holding",
  keyPoints: ["Point"],
  ...over,
});

describe("exposure lines (arithmetic, not opinion)", () => {
  it("one holding: weight, value, account", () => {
    expect(holdingExposure("AAPL", holdings)).toBe("AAPL is 10.8% of your portfolio ($2,080.00), non-registered account.");
    expect(holdingExposure("VEQT", holdings)).toBe("VEQT is 36.0% of your portfolio ($6,900.00), TFSA account.");
  });

  it("an unheld ticker or cash has no exposure line", () => {
    expect(holdingExposure("TSLA", holdings)).toBeNull();
    expect(holdingExposure("CASH", holdings)).toBeNull();
  });

  it("a group: held tickers only, largest first, combined weight and value", () => {
    expect(groupExposure(["XEQT", "VEQT", "VFV", "TSLA"], holdings)).toBe(
      "Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00)."
    );
    expect(groupExposure(["TSLA"], holdings)).toBeNull();
  });
});

describe("MockNewsProvider", () => {
  it("serves the stories it was given, labelled as mock", () => {
    const p = new MockNewsProvider(news);
    expect(p.source).toBe("mock");
    expect(p.stories()).toEqual(news);
  });
});

describe("buildDigest on the seed", () => {
  const d = buildDigest(holdings, news)!;

  it("is as of the price date", () => {
    expect(d.asOf).toBe("Nov 25, 2026");
  });

  it("market brief: the Nov 20 selloff with its source, date, and group exposure", () => {
    expect(d.market).toHaveLength(1);
    expect(d.market[0]).toMatchObject({
      id: "news-2026-11-20-selloff",
      source: "Market brief — Nov 20, 2026 selloff (verified)",
      date: "Nov 20, 2026",
      sample: false,
      touches: "Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00).",
    });
  });

  it("one card per holding with news, largest holding first", () => {
    expect(d.cards.map((c) => c.ticker)).toEqual(["AAPL", "SHOP"]);
    expect(d.cards[0]).toMatchObject({
      name: "Apple Inc.",
      exposure: "AAPL is 10.8% of your portfolio ($2,080.00), non-registered account.",
    });
    expect(d.cards[0].stories[0].upcoming).toEqual({ date: "Jan 28, 2027", label: "Quarterly results expected", sample: true });
  });

  it("names the holdings with no news, without padding", () => {
    expect(d.quiet).toBe("No stories this period for MSFT.");
  });
});

describe("buildDigest edge cases", () => {
  it("caps at 3 market stories and 2 per holding, newest first", () => {
    const many = [
      ...[1, 2, 3, 4, 5].map((i) => story({ id: `m${i}`, scope: "market", tickers: ["VEQT"], publishedAt: `2026-11-0${i}` })),
      ...[1, 2, 3, 4].map((i) => story({ id: `a${i}`, tickers: ["AAPL"], publishedAt: `2026-11-0${i}` })),
    ];
    const d = buildDigest(holdings, many)!;
    expect(d.market.map((s) => s.id)).toEqual(["m5", "m4", "m3"]);
    expect(d.cards.find((c) => c.ticker === "AAPL")!.stories.map((s) => s.id)).toEqual(["a4", "a3"]);
  });

  it("a story about only unheld tickers produces nothing", () => {
    const d = buildDigest(holdings, [story({ tickers: ["TSLA"] }), story({ id: "y", scope: "market", tickers: ["TSLA"] })])!;
    expect(d.cards).toEqual([]);
    expect(d.market).toEqual([]);
  });

  it("no holdings → no digest", () => {
    expect(buildDigest([], news)).toBeNull();
  });

  it("no stories at all → every holding is quiet", () => {
    expect(buildDigest(holdings, [])!.quiet).toBe("No stories this period for VEQT, MSFT, VFV, XEQT, AAPL, SHOP.");
  });
});
