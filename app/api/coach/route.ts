import benchmarkSeed from "../../../data/benchmark.seed.json";
import holdingsSeed from "../../../data/holdings.seed.json";
import { answerQuestion, createHistoryStore, createRateLimiter, validateQuestion } from "../../../lib/coach";
import { createOpenAIModel } from "../../../lib/openai";
import type { BenchmarkPoint, Holding } from "../../../lib/types";

/**
 * HTTP boundary for the coach (AGENT.md §2). The browser sends
 * { question } and gets { answer, citations, toolsUsed, source, isRefusal }.
 * The LLM key stays server-side. Questions and answers are never logged.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ctx = { holdings: holdingsSeed as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const history = createHistoryStore();

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

/** One demo user; until auth lands, the client IP keys the rate limit and history. */
const clientId = (req: Request) => req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "anonymous";

export async function POST(req: Request): Promise<Response> {
  const userId = clientId(req);
  if (!limiter.allow(userId)) {
    return json({ error: "Too many questions. Wait a minute and try again." }, 429, { "Retry-After": "60" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Send JSON: { \"question\": \"...\" }." }, 400);
  }
  const valid = validateQuestion((body as { question?: unknown } | null)?.question);
  if (!valid.ok) return json({ error: valid.error }, 400);

  const apiKey = process.env.LLM_API_KEY;
  const callModel = apiKey
    ? createOpenAIModel({ apiKey, model: process.env.LLM_MODEL || "gpt-4o-mini" })
    : null;

  const r = await answerQuestion(valid.question, { ctx, callModel, userId, history });
  return json({ answer: r.answer, citations: r.citations, toolsUsed: r.toolsUsed, source: r.source, isRefusal: r.isRefusal });
}
