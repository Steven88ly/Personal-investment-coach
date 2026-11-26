import { describe, expect, it } from "vitest";
import { NEUTRALITY_LINE, type CallModel, type ChatMessage } from "../lib/agent";
import {
  MAX_QUESTION_CHARS,
  answerQuestion,
  buildSystemPrompt,
  createHistoryStore,
  createRateLimiter,
  loadCoachPrompt,
  validateQuestion,
} from "../lib/coach";
import type { BenchmarkPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const ctx = { holdings: holdingsSeed as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };

describe("system prompt", () => {
  it("is lib/coach-prompt.md plus the tool-use rules", () => {
    const prompt = buildSystemPrompt(loadCoachPrompt());
    expect(prompt).toContain("No personalised investment advice, ever.");
    expect(prompt).toMatch(/Use the tools/);
    expect(prompt).toMatch(/quote figures exactly as the tools return them/i);
  });

  it("tells the coach to cite news by source and date and stay neutral about it", () => {
    const prompt = buildSystemPrompt(loadCoachPrompt());
    expect(prompt).toMatch(/cite the source and date/i);
    expect(prompt).toMatch(/never say whether news is good or bad/i);
  });

  it("gives the model the fixed neutrality line and the 'you own' wording", () => {
    const prompt = buildSystemPrompt(loadCoachPrompt());
    expect(prompt).toContain(NEUTRALITY_LINE);
    expect(prompt).toMatch(/say "you own", not "you hold"/i);
  });

  it("asks for 'touches', never 'affects' or 'impacts', and the source by name", () => {
    const prompt = buildSystemPrompt(loadCoachPrompt());
    expect(prompt).toMatch(/say a story "touches" holdings; never that it affects or impacts them/i);
    expect(prompt).toMatch(/name the source as given/i);
  });

  it("asks for plain text and a plain 'can't answer' for off-topic questions", () => {
    const prompt = buildSystemPrompt(loadCoachPrompt());
    expect(prompt).toMatch(/plain text: no Markdown/i);
    expect(prompt).toMatch(/say plainly that you can't answer it from their portfolio data/i);
  });
});

describe("validateQuestion (AGENT.md §5 input validation)", () => {
  it("trims and accepts a normal question", () => {
    expect(validateQuestion("  How am I doing?  ")).toEqual({ ok: true, question: "How am I doing?" });
  });

  it("rejects non-strings, empty, and over-length questions", () => {
    expect(validateQuestion(42)).toEqual({ ok: false, error: "Ask a question as text." });
    expect(validateQuestion("   ")).toEqual({ ok: false, error: "Ask a question as text." });
    expect(validateQuestion("x".repeat(MAX_QUESTION_CHARS + 1))).toEqual({
      ok: false,
      error: `Keep questions under ${MAX_QUESTION_CHARS} characters.`,
    });
    expect(MAX_QUESTION_CHARS).toBe(500);
  });

  it("strips HTML and control characters", () => {
    expect(validateQuestion("<script>alert(1)</script>How am I <b>doing</b>?\u0000")).toEqual({
      ok: true,
      question: "alert(1)How am I doing?",
    });
  });
});

describe("rate limiter: 10 per minute per user", () => {
  it("allows 10, blocks the 11th, and frees up after the window", () => {
    let now = 0;
    const limiter = createRateLimiter({ limit: 10, windowMs: 60_000, now: () => now });
    for (let i = 0; i < 10; i++) expect(limiter.allow("a")).toBe(true);
    expect(limiter.allow("a")).toBe(false);
    expect(limiter.allow("b")).toBe(true);
    now = 60_001;
    expect(limiter.allow("a")).toBe(true);
  });
});

describe("answerQuestion: live, fallback, and pre-check routing", () => {
  const liveModel: CallModel = async (messages) => {
    const last = messages.at(-1)!;
    if (last.role === "tool") return { text: "Your portfolio is worth $19,182.00.", toolCalls: [] };
    return { text: null, toolCalls: [{ id: "1", name: "getPortfolioSummary", rawArgs: "{}" }] };
  };
  const broken: CallModel = async () => {
    throw new Error("down");
  };

  it("uses the live coach when a model is available", async () => {
    const r = await answerQuestion("How am I doing overall?", { ctx, callModel: liveModel, userId: "u", history: createHistoryStore() });
    expect(r).toMatchObject({ source: "live", toolsUsed: ["getPortfolioSummary"] });
  });

  it("no key → the rule-based fallback, labelled", async () => {
    const r = await answerQuestion("How am I doing overall?", { ctx, callModel: null, userId: "u", history: createHistoryStore() });
    expect(r.source).toBe("rule-based fallback");
    expect(r.answer).toContain("$19,182.00");
  });

  it("model failure → the rule-based fallback, labelled", async () => {
    const r = await answerQuestion("Am I beating VEQT?", { ctx, callModel: broken, userId: "u", history: createHistoryStore() });
    expect(r.source).toBe("rule-based fallback");
    expect(r.answer).toContain("11.5%");
  });

  it("an unknown question with the model down says it can't answer, never guesses", async () => {
    const r = await answerQuestion("asdf qwerty", { ctx, callModel: broken, userId: "u", history: createHistoryStore() });
    expect(r.source).toBe("rule-based fallback");
    expect(r.answer).toMatch(/can't answer that from your portfolio data/);
  });

  it("advice questions are refused by the pre-check even without a key", async () => {
    const r = await answerQuestion("Should I sell SHOP?", { ctx, callModel: null, userId: "u", history: createHistoryStore() });
    expect(r).toMatchObject({ source: "pre-check", isRefusal: true });
  });

  it("remembers the last turns per user, capped, and only after live answers", async () => {
    const history = createHistoryStore();
    for (let i = 0; i < 7; i++) {
      await answerQuestion(`How am I doing overall? ${i}`, { ctx, callModel: liveModel, userId: "u", history });
    }
    const turns: ChatMessage[] = history.get("u");
    expect(turns).toHaveLength(10);
    expect(turns.at(-2)).toEqual({ role: "user", content: "How am I doing overall? 6" });
    expect(turns.at(-1)!.role).toBe("assistant");
    expect(history.get("other")).toEqual([]);
  });
});
