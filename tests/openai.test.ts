import { describe, expect, it } from "vitest";
import { ModelApiError, createOpenAIModel } from "../lib/openai";
import { TOOL_DEFS } from "../lib/tools";

const KEY = "sk-test-not-a-real-key";
const ok = (message: unknown) =>
  new Response(JSON.stringify({ choices: [{ message }] }), { status: 200, headers: { "content-type": "application/json" } });
const status = (code: number, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify({ error: { message: `HTTP ${code} for ${KEY}` } }), { status: code, headers });

function harness(...responses: (Response | Error)[]) {
  const requests: { url: string; init: RequestInit }[] = [];
  const sleeps: number[] = [];
  const model = createOpenAIModel({
    apiKey: KEY,
    model: "gpt-4o-mini",
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init: init! });
      const next = responses.shift();
      if (!next) throw new Error("fetch called more times than scripted");
      if (next instanceof Error) throw next;
      return next;
    },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { model, requests, sleeps };
}

const user = [{ role: "user" as const, content: "hi" }];

describe("request shape", () => {
  it("posts to chat completions with the key server-side, the model, and the tools", async () => {
    const { model, requests } = harness(ok({ content: "hello" }));
    await model(user, { tools: TOOL_DEFS });
    const { url, init } = requests[0];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.tools).toHaveLength(TOOL_DEFS.length);
    expect(body.tools[0]).toMatchObject({ type: "function", function: { name: TOOL_DEFS[0].name } });
  });

  it("sends no tools when asked for a plain-text answer", async () => {
    const { model, requests } = harness(ok({ content: "hello" }));
    await model(user, { tools: null });
    expect(JSON.parse(String(requests[0].init.body)).tools).toBeUndefined();
  });

  it("parses text and tool calls", async () => {
    const { model } = harness(
      ok({
        content: null,
        tool_calls: [{ id: "c1", type: "function", function: { name: "getAllocation", arguments: "{}" } }],
      })
    );
    expect(await model(user, { tools: TOOL_DEFS })).toEqual({
      text: null,
      toolCalls: [{ id: "c1", name: "getAllocation", rawArgs: "{}" }],
    });
  });
});

describe("retry policy (AGENT.md §4)", () => {
  it("server errors back off 1s, 2s, 4s, then give up", async () => {
    const { model, requests, sleeps } = harness(status(500), status(502), status(503), status(500));
    await expect(model(user, { tools: null })).rejects.toMatchObject({ status: 500 });
    expect(requests).toHaveLength(4);
    expect(sleeps).toEqual([1000, 2000, 4000]);
  });

  it("recovers when a retry succeeds", async () => {
    const { model, sleeps } = harness(status(500), ok({ content: "back" }));
    expect((await model(user, { tools: null })).text).toBe("back");
    expect(sleeps).toEqual([1000]);
  });

  it("network errors and timeouts are retried like server errors", async () => {
    const { model, sleeps } = harness(new TypeError("fetch failed"), ok({ content: "back" }));
    expect((await model(user, { tools: null })).text).toBe("back");
    expect(sleeps).toEqual([1000]);
  });

  it("429 respects Retry-After", async () => {
    const { model, sleeps } = harness(status(429, { "retry-after": "3" }), ok({ content: "back" }));
    await model(user, { tools: null });
    expect(sleeps).toEqual([3000]);
  });

  it("429 without Retry-After uses the backoff", async () => {
    const { model, sleeps } = harness(status(429), status(429), ok({ content: "back" }));
    await model(user, { tools: null });
    expect(sleeps).toEqual([1000, 2000]);
  });

  it.each([400, 401, 403])("%i is never retried", async (code) => {
    const { model, requests, sleeps } = harness(status(code));
    await expect(model(user, { tools: null })).rejects.toBeInstanceOf(ModelApiError);
    expect(requests).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("errors never carry the API key", async () => {
    const { model } = harness(status(401));
    const err = await model(user, { tools: null }).catch((e: Error) => e);
    expect(String((err as Error).message)).not.toContain(KEY);
    expect(JSON.stringify(err)).not.toContain(KEY);
  });

  it("a response with no choices is an error, not a crash", async () => {
    const { model } = harness(new Response("{}", { status: 200 }));
    await expect(model(user, { tools: null })).rejects.toBeInstanceOf(ModelApiError);
  });
});
