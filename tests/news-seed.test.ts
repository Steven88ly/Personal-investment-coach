import { describe, expect, it } from "vitest";
import { NON_NEUTRAL_TERMS, containsNonNeutral, containsNonNeutralAnswer, sentimentTone } from "../lib/news";
import type { NewsItem } from "../lib/types";
import newsSeed from "../data/news.seed.json";

const news = newsSeed as NewsItem[];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

describe("news seed: shape", () => {
  it("every story has the required fields", () => {
    for (const n of news) {
      expect(n.id).toBeTruthy();
      expect(n.title).toBeTruthy();
      expect(n.summary).toBeTruthy();
      expect(n.source).toBeTruthy();
      expect(n.publishedAt).toMatch(ISO);
      expect(n.publishedAt <= "2026-11-25").toBe(true);
      expect(Array.isArray(n.tickers)).toBe(true);
      expect(typeof n.sample).toBe("boolean");
      expect(["market", "holding"]).toContain(n.scope);
      expect(n.keyPoints.length).toBeGreaterThanOrEqual(1);
      expect(n.keyPoints.length).toBeLessThanOrEqual(3);
    }
  });

  it("the Nov 20 selloff is the real market brief, touching the three ETFs", () => {
    const brief = news.find((n) => n.id === "news-2026-11-20-selloff")!;
    expect(brief).toMatchObject({ scope: "market", sample: false, tickers: ["VEQT", "VFV", "XEQT"] });
  });

  it("AAPL and SHOP each have a labelled sample holding story", () => {
    for (const ticker of ["AAPL", "SHOP"]) {
      const story = news.find((n) => n.scope === "holding" && n.tickers.includes(ticker))!;
      expect(story.sample).toBe(true);
      expect(story.source).toMatch(/^Sample/);
    }
  });

  it("every upcoming date on a sample story is itself marked sample", () => {
    for (const n of news.filter((x) => x.sample && x.upcoming)) {
      expect(n.upcoming!.sample).toBe(true);
      expect(n.upcoming!.date).toMatch(ISO);
    }
  });
});

describe("sample sentiment", () => {
  const LABELS = ["Bearish", "Somewhat-Bearish", "Neutral", "Somewhat-Bullish", "Bullish"];

  it("every story has a rating on Alpha Vantage's scale, attributed to its source", () => {
    for (const n of news) {
      expect(LABELS, n.id).toContain(n.sentiment?.label);
      expect(n.sentiment?.source, n.id).toBe("Sample sentiment");
    }
  });

  it("rates the three seed stories as agreed", () => {
    const by = Object.fromEntries(news.map((n) => [n.id, n.sentiment?.label]));
    expect(by).toEqual({
      "news-2026-11-20-selloff": "Bearish",
      "news-sample-aapl-earnings": "Neutral",
      "news-sample-shop-holiday": "Somewhat-Bullish",
    });
  });

  it("maps each label to a tone for colour", () => {
    expect(sentimentTone("Bullish")).toBe("bullish");
    expect(sentimentTone("Somewhat-Bullish")).toBe("bullish");
    expect(sentimentTone("Neutral")).toBe("neutral");
    expect(sentimentTone("Somewhat-Bearish")).toBe("bearish");
    expect(sentimentTone("Bearish")).toBe("bearish");
  });
});

describe("answer check vs story check", () => {
  it("answers may say 'you hold'; story text may not use 'hold' at all", () => {
    expect(containsNonNeutralAnswer("You hold AAPL in your non-registered account.")).toBeNull();
    expect(containsNonNeutralAnswer("It holds up well and you should hold it")).toBe("should");
    expect(containsNonNeutral("You hold AAPL")).toBe("hold");
  });
});

describe("neutrality guard", () => {
  it("no story text uses an evaluative or directional term", () => {
    for (const n of news) {
      for (const text of [n.title, n.summary, ...n.keyPoints, n.upcoming?.label ?? ""]) {
        expect(containsNonNeutral(text), `${n.id}: "${text}"`).toBeNull();
      }
    }
  });

  it("matches whole words, case-insensitively", () => {
    expect(containsNonNeutral("Shares look Strong")).toBe("strong");
    expect(containsNonNeutral("Should investors wait?")).toBe("should");
    expect(containsNonNeutral("Your holdings and their shoulders")).toBeNull();
  });

  it("covers the anti-goal vocabulary from the design", () => {
    for (const term of ["good", "bad", "bullish", "bearish", "opportunity", "worry", "should", "buy", "sell", "hold"]) {
      expect(NON_NEUTRAL_TERMS).toContain(term);
    }
  });

  it("also rejects impact language: a story touches holdings, it doesn't 'affect' them", () => {
    expect(containsNonNeutral("Your portfolio is affected by a selloff")).toBe("affected");
    expect(containsNonNeutral("This impacts VEQT")).toBe("impacts");
    for (const term of ["affect", "affects", "affected", "impact", "impacts", "impacted"]) {
      expect(NON_NEUTRAL_TERMS).toContain(term);
    }
  });
});
