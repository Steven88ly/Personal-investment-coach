import benchmarkSeed from "../../../data/benchmark.seed.json";
import holdingsSeed from "../../../data/holdings.seed.json";
import { requestUser } from "../../../lib/auth";
import { answerQuestion, createHistoryStore, validateQuestion } from "../../../lib/coach";
import { createOpenAIModel } from "../../../lib/openai";
import { clientIp, createDailyBudget, createRateLimiter } from "../../../lib/rate-limit";
import type { BenchmarkPoint, Holding } from "../../../lib/types";

/**
 * HTTP boundary for the coach (AGENT.md §2). The browser sends
 * { question } and gets { answer, citations, toolsUsed, source, isRefusal }.
 * The LLM key stays server-side. Questions and answers are never logged.
 *
 * Controls, in order: session (again, behind the middleware), rate limit,
 * JSON only, body size, question validation, daily model budget.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 2048;
const DAILY_LIMIT = Number.parseInt(process.env.COACH_DAILY_LIMIT ?? "", 10);

const ctx = { holdings: holdingsSeed as Holding[], benchmark: benchmarkSeed as BenchmarkPoint[] };
const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const budget = createDailyBudget({ limit: Number.isFinite(DAILY_LIMIT) && DAILY_LIMIT >= 0 ? DAILY_LIMIT : 300 });
const history = createHistoryStore();

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

export async function POST(req: Request): Promise<Response> {
  const user = await requestUser(req);
  if (!user) return json({ error: "Sign in first." }, 401);

  if (!limiter.allow(`${user}:${clientIp(req)}`)) {
    return json({ error: "Too many questions. Wait a minute and try again." }, 429, { "Retry-After": "60" });
  }

  // JSON only: with the SameSite cookie, this blocks cross-site form posts.
  if (!(req.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return json({ error: "Send JSON." }, 415);
  }
  const raw = await req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return json({ error: "Request too large." }, 413);

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "Send JSON: { \"question\": \"...\" }." }, 400);
  }
  const valid = validateQuestion((body as { question?: unknown } | null)?.question);
  if (!valid.ok) return json({ error: valid.error }, 400);

  const apiKey = process.env.LLM_API_KEY;
  const callModel =
    apiKey && budget.take() ? createOpenAIModel({ apiKey, model: process.env.LLM_MODEL || "gpt-4o-mini" }) : null;

  const r = await answerQuestion(valid.question, { ctx, callModel, userId: user, history });
  return json({ answer: r.answer, citations: r.citations, toolsUsed: r.toolsUsed, source: r.source, isRefusal: r.isRefusal });
}
