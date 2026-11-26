import { describe, expect, it } from "vitest";
import {
  COACH_DISCLAIMER,
  MAX_STEPS,
  NEUTRALITY_LINE,
  SAMPLE_NOTE,
  runCoach,
  type CallModel,
  type ChatMessage,
  type ModelReply,
} from "../lib/agent";
import { containsNonNeutral } from "../lib/news";
import type { BenchmarkPoint, Holding, NewsItem } from "../lib/types";
import newsSeed from "../data/news.seed.json";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const ctx = { holdings: holdingsSeed as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };

const text = (t: string): ModelReply => ({ text: t, toolCalls: [] });
const call = (name: string, args: unknown, id = name): ModelReply => ({
  text: null,
  toolCalls: [{ id, name, rawArgs: typeof args === "string" ? args : JSON.stringify(args) }],
});

/** A scripted model: replies in order, records what it was sent. */
function scripted(...replies: ModelReply[]) {
  const calls: { messages: ChatMessage[]; toolsOffered: boolean }[] = [];
  const model: CallModel = async (messages, opts) => {
    calls.push({ messages: structuredClone(messages), toolsOffered: opts.tools !== null });
    const next = replies.shift();
    if (!next) throw new Error("model called more times than scripted");
    return next;
  };
  return { model, calls };
}

const run = (question: string, model: CallModel, history: ChatMessage[] = []) =>
  runCoach(question, { callModel: model, ctx, systemPrompt: "SYSTEM", history });

describe("the loop: tool call, then a grounded answer", () => {
  it("answers from tool data, lists the tools and citations, adds the disclaimer", async () => {
    const { model } = scripted(
      call("getPortfolioSummary", {}),
      text("Your portfolio is worth $19,182.00, up $1,572.00 (+8.93%).")
    );
    const r = await run("How am I doing overall?", model);
    expect(r.answer).toBe(`Your portfolio is worth $19,182.00, up $1,572.00 (+8.93%).\n\n${COACH_DISCLAIMER}`);
    expect(r.toolsUsed).toEqual(["getPortfolioSummary"]);
    expect(r.citations).toEqual([
      "Portfolio summary: total value $19,182.00",
      "Portfolio summary: gain +$1,572.00",
      "Portfolio summary: gain pct +8.93%",
    ]);
    expect(r).toMatchObject({ source: "live", isRefusal: false });
  });

  it("sends the system prompt, capped history, and question, then the tool result", async () => {
    const history: ChatMessage[] = Array.from({ length: 14 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      content: `turn ${i}`,
    })) as ChatMessage[];
    const { model, calls } = scripted(call("getAllocation", {}), text("VEQT is 35.97% of your portfolio."));
    await run("What's my biggest holding?", model, history);
    const first = calls[0].messages;
    expect(first[0]).toEqual({ role: "system", content: "SYSTEM" });
    expect(first.slice(1, -1).map((m) => m.content)).toEqual(history.slice(-10).map((m) => m.content));
    expect(first.at(-1)).toEqual({ role: "user", content: "What's my biggest holding?" });
    const toolMsg = calls[1].messages.at(-1)!;
    expect(toolMsg.role).toBe("tool");
    expect(toolMsg.content).toContain("35.97%");
  });

  it("replaces a model-written disclaimer (any wording) with the single official one", async () => {
    const { model } = scripted(text("All good.\n\nEducational only — not financial advice. Prices are mock data."));
    const r = await run("Hi", model);
    expect(r.answer).toBe(`All good.\n\n${COACH_DISCLAIMER}`);
  });

  it("strips Markdown emphasis so the chat shows plain text", async () => {
    const { model } = scripted(text("The formula is **FV = P × ((1 + r)^n − 1) / r**, where __r__ is the rate."));
    const r = await run("Hi", model);
    expect(r.answer).not.toMatch(/\*\*|__/);
    expect(r.answer).toContain("The formula is FV = P × ((1 + r)^n − 1) / r, where r is the rate.");
  });

  it("does not repeat the disclaimer if the model already wrote it", async () => {
    const { model } = scripted(text(`Nothing to cite here.\n\n${COACH_DISCLAIMER}`));
    const r = await run("Hi", model);
    expect(r.answer.split(COACH_DISCLAIMER)).toHaveLength(2);
  });
});

describe("pre-check (advice routing)", () => {
  it.each(["Should I buy more VEQT?", "Should I sell SHOP?", "What should I invest in?"])(
    "%s → refusal, model never called",
    async (q) => {
      const { model, calls } = scripted();
      const r = await run(q, model);
      expect(calls).toHaveLength(0);
      expect(r).toMatchObject({ source: "pre-check", isRefusal: true, toolsUsed: [] });
      expect(r.answer).toMatch(/not a financial advisor/);
      expect(r.answer).toContain("Educational only");
    }
  );
});

describe("retry policy for tool calls (AGENT.md §4)", () => {
  it("feeds a validation error back; the corrected call runs", async () => {
    const { model, calls } = scripted(
      call("projectContributions", { monthlyCents: "200", annualReturnPct: 7, years: 10 }),
      call("projectContributions", { monthlyCents: 20000, annualReturnPct: 7, years: 10 }),
      text("$200 a month becomes $34,616.96.")
    );
    const r = await run("What does $200 a month become in 10 years at 7%?", model);
    expect(calls[1].messages.at(-1)!.content).toMatch(/Error: projectContributions: "monthlyCents" must be a number/);
    expect(r.answer).toContain("$34,616.96");
    expect(r.toolsUsed).toEqual(["projectContributions"]);
  });

  it("the same tool failing twice stops the loop and forces an answer without tools", async () => {
    const bad = { monthlyCents: -1, annualReturnPct: 7, years: 10 };
    const { model, calls } = scripted(
      call("projectContributions", bad),
      call("projectContributions", bad),
      text("I couldn't run that projection.")
    );
    const r = await run("Project $-1 a month", model);
    expect(calls).toHaveLength(3);
    expect(calls[2].toolsOffered).toBe(false);
    expect(r.answer).toContain("I couldn't run that projection.");
  });

  it("a malformed tool call is re-prompted once, then falls back to a plain-text answer", async () => {
    const { model, calls } = scripted(
      call("getPortfolioSummary", "{not json"),
      call("getPortfolioSummary", "{still not json"),
      text("I can't look that up right now.")
    );
    const r = await run("How am I doing?", model);
    expect(calls[1].messages.at(-1)!.content).toMatch(/could not be parsed/);
    expect(calls[2].toolsOffered).toBe(false);
    expect(r.toolsUsed).toEqual([]);
  });

  it("an unknown tool is an error fed back, not a crash", async () => {
    const { model, calls } = scripted(call("placeTrade", { ticker: "SHOP" }), text("I can only read your data."));
    const r = await run("Buy it for me", model);
    expect(calls[1].messages.at(-1)!.content).toMatch(/Unknown tool "placeTrade"/);
    expect(r.answer).toContain("I can only read your data.");
  });

  it(`stops after ${MAX_STEPS} steps and forces a final answer`, async () => {
    const loops = Array.from({ length: MAX_STEPS }, (_, i) => call("getAllocation", {}, `c${i}`));
    const { model, calls } = scripted(...loops, text("Here is what I found."));
    const r = await run("Tell me everything", model);
    expect(calls).toHaveLength(MAX_STEPS + 1);
    expect(calls.at(-1)!.toolsOffered).toBe(false);
    expect(r.answer).toContain("Here is what I found.");
  });

  it("answers every tool call in a parallel batch", async () => {
    const { model, calls } = scripted(
      {
        text: null,
        toolCalls: [
          { id: "a", name: "getPortfolioSummary", rawArgs: "{}" },
          { id: "b", name: "getBenchmarkComparison", rawArgs: "{}" },
        ],
      },
      text("Worth $19,182.00 and ahead of VEQT by +5.24pp.")
    );
    const r = await run("Overview?", model);
    const toolMsgs = calls[1].messages.filter((m) => m.role === "tool");
    expect(toolMsgs.map((m) => m.tool_call_id)).toEqual(["a", "b"]);
    expect(r.toolsUsed).toEqual(["getPortfolioSummary", "getBenchmarkComparison"]);
  });
});

describe("neutral-wording check on news answers", () => {
  const newsCtx = { ...ctx, news: newsSeed as NewsItem[] };
  const runNews = (q: string, model: CallModel) => runCoach(q, { callModel: model, ctx: newsCtx, systemPrompt: "SYSTEM" });

  it("a news answer with impact language is regenerated once, naming the words to drop", async () => {
    const { model, calls } = scripted(
      call("getMarketBrief", {}),
      text("A selloff affected your portfolio."),
      text("A broad selloff on Nov 20 touches VEQT, VFV and XEQT.")
    );
    const r = await runNews("What's moving my portfolio?", model);
    expect(calls).toHaveLength(3);
    expect(calls[2].messages.at(-1)!.content).toMatch(/affected/);
    expect(r.answer).toContain("touches VEQT, VFV and XEQT");
  });

  it("still not neutral after one retry → replaced by a neutral summary built from the stories", async () => {
    const { model } = scripted(
      call("getMarketBrief", {}),
      text("Bad news: the selloff impacted you."),
      text("Still a worrying selloff.")
    );
    const r = await runNews("What's moving my portfolio?", model);
    const body = r.answer.slice(0, r.answer.indexOf("Educational only"));
    expect(containsNonNeutral(body)).toBeNull();
    expect(body).toContain("Broad global selloff hits equities as AI trade unwinds");
    expect(body).toContain("Market brief — Nov 20, 2026 selloff (verified)");
    expect(body).toContain("Nov 20, 2026");
    expect(body).toContain("Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00).");
    expect(r.answer).toContain(COACH_DISCLAIMER);
  });

  it("'you hold' is ordinary neutral wording, not a recommendation", async () => {
    const { model, calls } = scripted(
      call("getHoldingNews", { ticker: "AAPL" }),
      text("You hold AAPL in your non-registered account. Sample: a story covers its upcoming results.")
    );
    await runNews("Any news on AAPL?", model);
    expect(calls).toHaveLength(2);
  });

  it("asked whether news is good or bad, the fallback opens with the fixed neutrality line", async () => {
    const { model } = scripted(
      call("getMarketBrief", {}),
      text("I can't say whether this is good or bad for you."),
      text("It isn't good or bad, it's just news.")
    );
    const r = await runNews("Is this news good for me?", model);
    expect(r.answer.startsWith(NEUTRALITY_LINE)).toBe(true);
    const body = r.answer.slice(0, r.answer.indexOf("Educational only"));
    expect(containsNonNeutral(body)).toBeNull();
  });

  it("an answer drawing on a sample story always says sample stories aren't real", async () => {
    const { model } = scripted(call("getHoldingNews", { ticker: "AAPL" }), text("AAPL reports quarterly results on Jan 28, 2027."));
    const r = await runNews("When does AAPL report?", model);
    expect(r.answer).toContain(SAMPLE_NOTE);
  });

  it("an answer with no sample stories gets no sample note", async () => {
    const { model } = scripted(call("getMarketBrief", {}), text("A selloff on Nov 20 touches VEQT, VFV and XEQT."));
    const r = await runNews("What's moving my portfolio?", model);
    expect(r.answer).not.toContain(SAMPLE_NOTE);
  });

  it("every story a news tool returned is listed under Sources with its source and date, figures or not", async () => {
    const { model } = scripted(call("getHoldingNews", { ticker: "AAPL" }), text("There's a sample story about AAPL."));
    const r = await runNews("Any news on AAPL?", model);
    expect(r.citations).toContain(
      "Holding news: [Sample] AAPL heads into earnings season (Sample — illustrative, not real news, Nov 25, 2026)"
    );
  });

  it("answers that didn't use news tools are left alone", async () => {
    const { model, calls } = scripted(call("getPortfolioSummary", {}), text("A strong total: $19,182.00."));
    await run("How am I doing?", model);
    expect(calls).toHaveLength(2);
  });
});

describe("citation check (AGENT.md §5)", () => {
  it("an uncited figure triggers one regeneration; a fixed answer passes", async () => {
    const { model, calls } = scripted(
      call("getPortfolioSummary", {}),
      text("You're worth $20,000.00."),
      text("You're worth $19,182.00.")
    );
    const r = await run("How am I doing?", model);
    expect(calls).toHaveLength(3);
    expect(calls[2].messages.at(-1)!.content).toMatch(/\$20,000\.00/);
    expect(r.answer).toContain("$19,182.00");
    expect(r.answer).not.toContain("$20,000.00");
  });

  it("still uncited after regeneration → the figure is removed and the answer says so", async () => {
    const { model } = scripted(text("You're worth $20,000.00."), text("Really, $20,000.00."));
    const r = await run("How am I doing?", model);
    expect(r.answer).not.toContain("$20,000.00");
    expect(r.answer).toContain("[figure removed: not in your data]");
    expect(r.answer).toContain("couldn't be verified");
  });

  it("numbers the user gave in the question count as cited", async () => {
    const { model, calls } = scripted(text("At 7%, $200 a month adds up."));
    await run("What does $200 a month become at 7%?", model);
    expect(calls).toHaveLength(1);
  });
});
