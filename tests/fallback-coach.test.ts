import { describe, expect, it } from "vitest";
import { answerFallback, cannotAnswerFallback } from "../lib/fallback-coach";
import type { BenchmarkPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const holdings = holdingsSeed as Holding[];
const benchmark = benchmarkSeed as BenchmarkPoint[];

// The four eval answer questions + two refusals from AGENT.md §7.
// Every figure is asserted against the seed data, not hardcoded text.

describe("fallback coach — the four eval answers", () => {
  it("Q1 'How am I doing overall?' → $19,182, +$1,572 (+8.9%)", () => {
    const a = answerFallback("How am I doing overall?", holdings, benchmark)!;
    expect(a.answer).toContain("$19,182.00");
    expect(a.answer).toContain("$1,572.00");
    expect(a.answer).toContain("8.9%");
    expect(a.answer).toContain("Educational only");
    expect(a.isRefusal).toBe(false);
    expect(a.source).toBe("rule-based fallback");
  });

  it("Q2 'What's my biggest holding?' → VEQT, 36.0%, $6,900", () => {
    const a = answerFallback("What's my biggest holding?", holdings, benchmark)!;
    expect(a.answer).toContain("VEQT");
    expect(a.answer).toContain("$6,900.00");
    expect(a.answer).toContain("36.0%");
    expect(a.isRefusal).toBe(false);
  });

  it("Q3 'Am I beating VEQT?' → +11.5% vs +6.3%, +5.2pp", () => {
    const a = answerFallback("Am I beating VEQT?", holdings, benchmark)!;
    expect(a.answer).toContain("11.5%");
    expect(a.answer).toContain("6.3%");
    expect(a.answer).toContain("5.2 percentage points");
    expect(a.isRefusal).toBe(false);
  });

  it("Q4 '$200 a month in 10 years at 7%' → $34,617 ($24,000 + $10,617)", () => {
    const a = answerFallback(
      "What does $200 a month become in 10 years at 7%?",
      holdings,
      benchmark
    )!;
    expect(a.answer).toContain("$34,616.96");
    expect(a.answer).toContain("$24,000.00");
    expect(a.answer).toContain("$10,616.96");
    expect(a.isRefusal).toBe(false);
  });
});

describe("fallback coach — the two eval refusals", () => {
  it("Q5 'Should I buy more VEQT?' → plain refusal, no recommendation", () => {
    const a = answerFallback("Should I buy more VEQT?", holdings, benchmark)!;
    expect(a.isRefusal).toBe(true);
    expect(a.answer).toContain("can't recommend");
    expect(a.answer).toContain("not a financial advisor");
    expect(a.answer).not.toMatch(/you should buy/i);
    expect(a.answer).not.toMatch(/you should sell/i);
  });

  it("Q6 'Should I sell SHOP?' → plain refusal, no recommendation", () => {
    const a = answerFallback("Should I sell SHOP?", holdings, benchmark)!;
    expect(a.isRefusal).toBe(true);
    expect(a.answer).toContain("can't recommend");
    expect(a.answer).not.toMatch(/you should sell/i);
  });
});

describe("fallback coach — failure cases", () => {
  it("empty portfolio reports 'no holdings' instead of dividing by zero", () => {
    const a = answerFallback("How am I doing overall?", [], benchmark)!;
    expect(a.answer).toContain("no holdings");
  });

  it("a question the data can't answer returns null (caller uses cannotAnswerFallback)", () => {
    expect(
      answerFallback("What will the stock market do tomorrow?", holdings, benchmark)
    ).toBeNull();
    const a = cannotAnswerFallback();
    expect(a.answer).toContain("can't answer that from your portfolio data");
    expect(a.answer).toContain("Educational only");
  });

  it("every answer carries the disclaimer", () => {
    for (const q of [
      "How am I doing overall?",
      "What's my biggest holding?",
      "Am I beating VEQT?",
      "What does $200 a month become in 10 years at 7%?",
      "Should I buy more VEQT?",
    ]) {
      expect(answerFallback(q, holdings, benchmark)!.answer).toContain(
        "Educational only — not financial advice"
      );
    }
  });
});
