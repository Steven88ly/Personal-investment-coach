import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../app/api/coach/route";

beforeEach(() => {
  delete process.env.LLM_API_KEY; // never hit the network from unit tests
});

let ip = 0;
const req = (body: unknown, from = `10.0.0.${++ip}`) =>
  new Request("http://localhost/api/coach", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": from },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/coach", () => {
  it("returns only answer, citations, toolsUsed, source, isRefusal — never cached", async () => {
    const res = await POST(req({ question: "How am I doing overall?" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["answer", "citations", "isRefusal", "source", "toolsUsed"]);
  });

  it("with no key configured, serves the labelled rule-based fallback", async () => {
    const body = await (await POST(req({ question: "What's my biggest holding?" }))).json();
    expect(body.source).toBe("rule-based fallback");
    expect(body.answer).toContain("VEQT");
  });

  it("rejects bad JSON and invalid questions with 400", async () => {
    expect((await POST(req("{nope"))).status).toBe(400);
    const res = await POST(req({ question: "" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Ask a question as text." });
    expect((await POST(req({ question: "x".repeat(501) }))).status).toBe(400);
  });

  it("rate-limits to 10 a minute per client with a Retry-After", async () => {
    const from = "192.168.1.50";
    for (let i = 0; i < 10; i++) expect((await POST(req({ question: "How am I doing?" }, from))).status).toBe(200);
    const blocked = await POST(req({ question: "How am I doing?" }, from));
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
  });
});
