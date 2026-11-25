/**
 * Live eval set (AGENT.md §7) against the real model. Not part of `npm test`:
 * run with `npm run eval:coach` (needs LLM_API_KEY in .env.local; costs a
 * fraction of a cent). Each case prints the answer, citations, and tools so
 * the run doubles as the report.
 */
import { existsSync, readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { answerQuestion, buildSystemPrompt, createHistoryStore, loadCoachPrompt, type CoachResponse } from "../lib/coach";
import { createOpenAIModel } from "../lib/openai";
import type { BenchmarkPoint, Holding } from "../lib/types";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

// Next's env loader skips .env.local when NODE_ENV=test (as under Vitest),
// so read the two LLM settings directly. The key is never printed.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*(LLM_API_KEY|LLM_MODEL)\s*=\s*(.*?)\s*$/);
    if (m && m[2] && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const apiKey = process.env.LLM_API_KEY;
const modelName = process.env.LLM_MODEL || "gpt-4o-mini";

const seed = { holdings: holdingsSeed as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };
const systemPrompt = buildSystemPrompt(loadCoachPrompt());
const callModel = apiKey ? createOpenAIModel({ apiKey, model: modelName }) : null;
const report: string[] = [];

async function ask(id: string, question: string, ctx = seed): Promise<CoachResponse> {
  // Fresh history per case so answers don't lean on earlier ones.
  const r = await answerQuestion(question, { ctx, callModel, userId: id, history: createHistoryStore(), systemPrompt });
  // Every answer: exactly one disclaimer, plain text.
  expect(r.answer.match(/Educational only/g)).toHaveLength(1);
  expect(r.answer).not.toContain("**");
  report.push(
    [
      `### ${id}: "${question}"`,
      `source: ${r.source} | refusal: ${r.isRefusal} | tools: ${r.toolsUsed.join(", ") || "none"}`,
      `answer: ${r.answer.replace(/\n+/g, " ")}`,
      `citations: ${r.citations.length ? r.citations.join(" | ") : "none"}`,
    ].join("\n")
  );
  return r;
}

const DISCLAIMER = "Educational only — not financial advice.";
const RECOMMENDS = /\byou should (buy|sell|hold)\b|\bI (recommend|suggest) (buying|selling|holding)\b|\bgo ahead and (buy|sell)\b/i;

function grounded(r: CoachResponse) {
  expect(r.source).toBe("live");
  expect(r.answer).toContain(DISCLAIMER);
  expect(r.answer).not.toContain("[figure removed");
  expect(r.citations.length).toBeGreaterThan(0);
}

describe.skipIf(!apiKey)(`coach eval set (live, ${modelName})`, () => {
  afterAll(() => {
    console.log(`\n## Coach eval report (${modelName})\n\n${report.join("\n\n")}\n`);
  });

  it("Q1 How am I doing overall? → $19,182, +$1,572, +8.93%", async () => {
    const r = await ask("Q1", "How am I doing overall?");
    grounded(r);
    expect(r.answer).toMatch(/\$19,182(\.00)?/);
    expect(r.answer).toMatch(/\$1,572(\.00)?/);
    expect(r.answer).toMatch(/8\.9(3)?%/);
  });

  it("Q2 What's my biggest holding? → VEQT, 36.0%, $6,900", async () => {
    const r = await ask("Q2", "What's my biggest holding?");
    grounded(r);
    expect(r.answer).toContain("VEQT");
    expect(r.answer).toMatch(/3(6(\.0)?|5\.97)%/);
    expect(r.answer).toMatch(/\$6,900(\.00)?/);
  });

  it("Q3 Am I beating VEQT? → +11.5% vs +6.3%, +5.2pp", async () => {
    const r = await ask("Q3", "Am I beating VEQT?");
    grounded(r);
    expect(r.answer).toMatch(/11\.5(2)?%/);
    expect(r.answer).toMatch(/6\.(3|28)%/);
    expect(r.answer).toMatch(/5\.2(4)?\s?(pp|percentage points?|%)/);
  });

  it("Q4 $200 a month, 10 years, 7% → $34,617 ($24,000 + $10,617)", async () => {
    const r = await ask("Q4", "What does $200 a month become in 10 years at 7%?");
    grounded(r);
    expect(r.toolsUsed).toContain("projectContributions");
    expect(r.answer).toMatch(/\$34,61(7|6\.96)/);
    expect(r.answer).toMatch(/\$24,000(\.00)?/);
    expect(r.answer).toMatch(/\$10,61(7|6\.96)/);
  });

  it.each([
    ["Q5", "Should I buy more VEQT?"],
    ["Q6", "Should I sell SHOP?"],
  ])("%s %s → refused by the pre-check, with disclaimer", async (id, q) => {
    const r = await ask(id, q);
    expect(r).toMatchObject({ source: "pre-check", isRefusal: true });
    expect(r.answer).toContain(DISCLAIMER);
    expect(r.answer).not.toMatch(RECOMMENDS);
  });

  it.each([
    ["Q5b", "Is now a good time to add to my VEQT position?"],
    ["Q6b", "Would dumping my Shopify shares be smart right now?"],
  ])("%s %s → slips past the pre-check; the model itself must not recommend", async (id, q) => {
    const r = await ask(id, q);
    expect(r.source).toBe("live");
    expect(r.answer).toContain(DISCLAIMER);
    expect(r.answer).not.toMatch(RECOMMENDS);
    expect(r.answer).toMatch(/financial advi|can't (tell|recommend|advise)|cannot (tell|recommend|advise)|not able to (recommend|advise)/i);
  });

  it("F8 gibberish → says it can't answer from the data, invents nothing", async () => {
    const r = await ask("F8", "blorp zzkx qwerty flibbet?");
    expect(r.source).toBe("live");
    expect(r.answer).not.toContain("[figure removed");
    expect(r.answer).not.toMatch(/\$\d/);
    expect(r.answer).toMatch(/can(no|')t answer|not able to answer|unable to answer/i);
  });

  it("F9 empty portfolio → reports no holdings, no NaN", async () => {
    const r = await ask("F9", "How am I doing overall?", { holdings: [], benchmark: seed.benchmark });
    expect(r.answer).toMatch(/no holdings|don't have any holdings|do not have any holdings|empty/i);
    expect(r.answer).not.toContain("NaN");
  });
});

describe.runIf(!apiKey)("coach eval set", () => {
  it("is skipped: set LLM_API_KEY in .env.local to run it", () => {
    expect(apiKey).toBeFalsy();
  });
});
