import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "../lib/auth";
import { createDailyBudget } from "../lib/rate-limit";

const SECRET = "s".repeat(40);

beforeEach(() => {
  delete process.env.LLM_API_KEY; // never hit the network from unit tests
  delete process.env.COACH_DAILY_LIMIT;
  process.env.DEMO_USER = "demo";
  process.env.DEMO_PASS = "a-real-passphrase";
  process.env.SESSION_SECRET = SECRET;
});

async function loadRoute() {
  vi.resetModules();
  return (await import("../app/api/coach/route")).POST;
}

let ip = 0;
async function req(
  body: unknown,
  opts: { from?: string; session?: string | null; contentType?: string } = {}
) {
  const session = opts.session === undefined ? await signSession("demo", SECRET) : opts.session;
  const headers: Record<string, string> = {
    "content-type": opts.contentType ?? "application/json",
    "x-forwarded-for": opts.from ?? `10.0.0.${++ip}`,
  };
  if (session) headers.cookie = `${SESSION_COOKIE}=${session}`;
  return new Request("http://localhost/api/coach", {
    method: "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/coach", () => {
  it("returns only answer, citations, toolsUsed, source, isRefusal — never cached", async () => {
    const POST = await loadRoute();
    const res = await POST(await req({ question: "How am I doing overall?" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["answer", "citations", "isRefusal", "source", "toolsUsed"]);
  });

  it("with no key configured, serves the labelled rule-based fallback", async () => {
    const POST = await loadRoute();
    const body = await (await POST(await req({ question: "What's my biggest holding?" }))).json();
    expect(body.source).toBe("rule-based fallback");
    expect(body.answer).toContain("VEQT");
  });

  it("requires a valid session itself, not only via middleware", async () => {
    const POST = await loadRoute();
    expect((await POST(await req({ question: "Hi" }, { session: null }))).status).toBe(401);
    const forged = await signSession("demo", "f".repeat(40));
    expect((await POST(await req({ question: "Hi" }, { session: forged }))).status).toBe(401);
  });

  it("accepts JSON only (415) and caps the body size (413)", async () => {
    const POST = await loadRoute();
    expect((await POST(await req("question=hi", { contentType: "application/x-www-form-urlencoded" }))).status).toBe(415);
    expect((await POST(await req({ question: "x".repeat(400), pad: "y".repeat(3000) }))).status).toBe(413);
  });

  it("rejects bad JSON and invalid questions with 400", async () => {
    const POST = await loadRoute();
    expect((await POST(await req("{nope"))).status).toBe(400);
    const res = await POST(await req({ question: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ask a question as text." });
    expect((await POST(await req({ question: "x".repeat(501) }))).status).toBe(400);
  });

  it("rate-limits to 10 a minute per client with a Retry-After", async () => {
    const POST = await loadRoute();
    const from = "192.168.1.50";
    for (let i = 0; i < 10; i++) expect((await POST(await req({ question: "How am I doing?" }, { from }))).status).toBe(200);
    const blocked = await POST(await req({ question: "How am I doing?" }, { from }));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
  });

  it("once the daily model budget is spent, answers come from the labelled fallback (no API call)", async () => {
    process.env.LLM_API_KEY = "sk-test-never-used";
    process.env.COACH_DAILY_LIMIT = "0";
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const POST = await loadRoute();
    const body = await (await POST(await req({ question: "Am I beating VEQT?" }))).json();
    expect(body.source).toBe("rule-based fallback");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe("createDailyBudget", () => {
  it("allows the limit per UTC day, then resets the next day", () => {
    let now = Date.UTC(2026, 10, 26, 10);
    const budget = createDailyBudget({ limit: 2, now: () => now });
    expect([budget.take(), budget.take(), budget.take()]).toEqual([true, true, false]);
    now = Date.UTC(2026, 10, 27, 0, 0, 1);
    expect(budget.take()).toBe(true);
  });
});
