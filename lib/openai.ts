import type { CallModel, ChatMessage, ModelReply } from "./agent";
import type { ToolDef } from "./tools";

/**
 * OpenAI chat-completions client with the AGENT.md §4 retry policy:
 * - 5xx, network errors, timeouts: back off 1s, 2s, 4s, then give up.
 * - 429: wait Retry-After if given (capped), else the same backoff.
 * - 400/401/403 (and other 4xx): never retried.
 * Server-side only. Errors never include the key or the provider's body.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";
const BACKOFF_MS = [1000, 2000, 4000];
const MAX_RETRY_AFTER_MS = 10_000;

export class ModelApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "ModelApiError";
  }
}

export interface OpenAIOptions {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

const realSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function toOpenAITools(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: "function" as const,
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export function createOpenAIModel(opts: OpenAIOptions): CallModel {
  const { apiKey, model, fetchImpl = fetch, sleep = realSleep, timeoutMs = 20_000 } = opts;

  async function attempt(messages: ChatMessage[], tools: ToolDef[] | null): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetchImpl(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          max_tokens: 600,
          ...(tools ? { tools: toOpenAITools(tools), tool_choice: "auto" } : {}),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  return async (messages, { tools }) => {
    for (let retry = 0; ; retry++) {
      let res: Response | null = null;
      try {
        res = await attempt(messages, tools);
      } catch {
        // Network error or timeout: transient.
      }

      if (res?.ok) return parse(await res.json().catch(() => null));

      const code = res?.status ?? 0; // 0 = network error / timeout
      const transient = code === 0 || code === 429 || code >= 500;
      if (!transient || retry >= BACKOFF_MS.length) {
        throw new ModelApiError(code, code === 0 ? "Model API unreachable" : `Model API returned HTTP ${code}`);
      }

      const retryAfter = Number(res?.headers.get("retry-after"));
      const wait =
        code === 429 && Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, MAX_RETRY_AFTER_MS)
          : BACKOFF_MS[retry];
      await sleep(wait);
    }
  };
}

function parse(body: unknown): ModelReply {
  const message = (body as { choices?: { message?: Record<string, unknown> }[] } | null)?.choices?.[0]?.message;
  if (!message) throw new ModelApiError(200, "Model API returned no choices");
  const calls = (message.tool_calls as { id: string; function: { name: string; arguments: string } }[] | undefined) ?? [];
  return {
    text: typeof message.content === "string" ? message.content : null,
    toolCalls: calls.map((c) => ({ id: c.id, name: c.function.name, rawArgs: c.function.arguments ?? "" })),
  };
}
