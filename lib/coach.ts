import { readFileSync } from "node:fs";
import path from "node:path";
import { MAX_HISTORY, runCoach, type CallModel, type ChatMessage, type CoachResult } from "./agent";
import { answerFallback, cannotAnswerFallback, isAdviceQuestion } from "./fallback-coach";
import type { ToolContext } from "./tools";

/**
 * Coach service: everything between the HTTP route and the agent loop.
 * Prompt assembly, input validation, per-user rate limit and history, and
 * the fallback rule (AGENT.md §9): no key or a failed model call → the
 * rule-based coach, labelled as such. Nothing here logs questions or answers.
 */

export const MAX_QUESTION_CHARS = 500;

export interface CoachResponse extends Omit<CoachResult, "source"> {
  source: CoachResult["source"] | "rule-based fallback";
}

/** The prompt file is the source of truth; the harness adds how to use tools. */
export function loadCoachPrompt(): string {
  return readFileSync(path.join(process.cwd(), "lib", "coach-prompt.md"), "utf8");
}

export function buildSystemPrompt(promptMarkdown: string): string {
  return `${promptMarkdown.trim()}

## Tools (how you get the data)

Use the tools to fetch every figure before answering; never answer from memory.
Quote figures exactly as the tools return them (you may round, e.g. $34,616.96 → $34,617).
Do not do your own arithmetic: if a figure isn't in a tool result, don't state it.
Prices are mock data: say so when quoting one. Keep answers under 120 words.
Write plain text: no Markdown, no bold, no headings, no bullet symbols.
If the question isn't about the user's portfolio or investing concepts, or the tools can't answer it,
say plainly that you can't answer it from their portfolio data, and list what you can answer.
The disclaimer is added for you; don't write one.`;
}

export type Validated = { ok: true; question: string } | { ok: false; error: string };

export function validateQuestion(raw: unknown): Validated {
  if (typeof raw !== "string") return { ok: false, error: "Ask a question as text." };
  const question = raw
    .replace(/<[^>]*>/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
  if (question === "") return { ok: false, error: "Ask a question as text." };
  if (question.length > MAX_QUESTION_CHARS) {
    return { ok: false, error: `Keep questions under ${MAX_QUESTION_CHARS} characters.` };
  }
  return { ok: true, question };
}

/** Sliding-window limiter, in memory (one demo user; per-instance on Vercel). */
export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number }) {
  const { limit, windowMs, now = Date.now } = opts;
  const hits = new Map<string, number[]>();
  return {
    allow(key: string): boolean {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((at) => t - at < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.set(key, recent);
      return true;
    },
  };
}

/** Last MAX_HISTORY messages per user; older turns are dropped, not summarised. */
export function createHistoryStore() {
  const store = new Map<string, ChatMessage[]>();
  return {
    get: (userId: string): ChatMessage[] => [...(store.get(userId) ?? [])],
    append(userId: string, messages: ChatMessage[]) {
      store.set(userId, [...(store.get(userId) ?? []), ...messages].slice(-MAX_HISTORY));
    },
  };
}
export type HistoryStore = ReturnType<typeof createHistoryStore>;

export interface AnswerDeps {
  ctx: ToolContext;
  /** null when no LLM key is configured. */
  callModel: CallModel | null;
  userId: string;
  history: HistoryStore;
  systemPrompt?: string;
}

function fallback(question: string, ctx: ToolContext): CoachResponse {
  const f = answerFallback(question, ctx.holdings, ctx.benchmark) ?? cannotAnswerFallback();
  return { answer: f.answer, citations: f.citations, toolsUsed: [], source: f.source, isRefusal: f.isRefusal };
}

export async function answerQuestion(question: string, deps: AnswerDeps): Promise<CoachResponse> {
  const { ctx, callModel, userId, history } = deps;

  if (isAdviceQuestion(question)) {
    const f = answerFallback(question, ctx.holdings, ctx.benchmark)!;
    return { answer: f.answer, citations: f.citations, toolsUsed: [], source: "pre-check", isRefusal: true };
  }
  if (!callModel) return fallback(question, ctx);

  try {
    const result = await runCoach(question, {
      callModel,
      ctx,
      systemPrompt: deps.systemPrompt ?? buildSystemPrompt(loadCoachPrompt()),
      history: history.get(userId),
    });
    history.append(userId, [
      { role: "user", content: question },
      { role: "assistant", content: result.answer },
    ]);
    return result;
  } catch (e) {
    // Model unavailable after retries (or rejected): degrade, never an empty chat.
    // Log the failure class only: never the question, answer, or figures.
    const status = (e as { status?: number }).status;
    console.warn(`coach: live model failed (${e instanceof Error ? e.name : "error"}${status ? ` ${status}` : ""}); serving fallback`);
    return fallback(question, ctx);
  }
}
