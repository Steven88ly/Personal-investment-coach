import { checkCitations, storyCitations, stripUncited, type ToolSource } from "./citations";
import { FALLBACK_DISCLAIMER, answerFallback, isAdviceQuestion } from "./fallback-coach";
import { containsNonNeutralAnswer, type StoryView } from "./news";
import { TOOL_DEFS, executeTool, validateArgs, type ToolContext, type ToolDef } from "./tools";

/**
 * The coach loop (AGENT.md §2). Hand-rolled so every line is explainable:
 * pre-check → up to MAX_STEPS model/tool rounds → citation check → answer
 * + disclaimer. It always terminates: a step cap, a per-tool failure cap,
 * and a parse-failure cap. The model only ever sees the system prompt, the
 * last MAX_HISTORY turns, the question, and tool results.
 */

export const MAX_STEPS = 5;
export const MAX_HISTORY = 10;
export const COACH_DISCLAIMER = FALLBACK_DISCLAIMER;
/** What the coach says (and the news fallback opens with) when asked to judge news. */
export const NEUTRALITY_LINE = "I report what happened and your exposure; I don't judge news or suggest actions.";
/** Appended whenever an answer drew on a sample story, so sample content is never unlabelled. */
export const SAMPLE_NOTE = "Stories marked sample are illustrative, not real news.";

export interface ToolCallMessage {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export type ChatMessage =
  | { role: "system" | "user"; content: string; tool_call_id?: undefined }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCallMessage[]; tool_call_id?: undefined }
  | { role: "tool"; content: string; tool_call_id: string };

export interface ModelReply {
  text: string | null;
  toolCalls: { id: string; name: string; rawArgs: string }[];
}

/** One model round-trip. `tools: null` means "answer in plain text now". */
export type CallModel = (messages: ChatMessage[], opts: { tools: ToolDef[] | null }) => Promise<ModelReply>;

export interface CoachResult {
  answer: string;
  citations: string[];
  toolsUsed: string[];
  source: "live" | "pre-check";
  isRefusal: boolean;
}

export interface CoachDeps {
  callModel: CallModel;
  ctx: ToolContext;
  systemPrompt: string;
  history?: ChatMessage[];
}

const FORCE_ANSWER =
  "Answer the question now, using only the tool results above. Do not call any tools. If the data can't answer it, say so.";

export async function runCoach(question: string, deps: CoachDeps): Promise<CoachResult> {
  const { callModel, ctx, systemPrompt, history = [] } = deps;

  // Pre-check layer: advice questions never reach the model.
  if (isAdviceQuestion(question)) {
    const refusal = answerFallback(question, ctx.holdings, ctx.benchmark)!;
    return { answer: refusal.answer, citations: refusal.citations, toolsUsed: [], source: "pre-check", isRefusal: true };
  }

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...history.slice(-MAX_HISTORY),
    { role: "user", content: question },
  ];
  const sources: ToolSource[] = [];
  const toolsUsed: string[] = [];
  const failures = new Map<string, number>();
  let parseFailures = 0;

  const fail = (id: string, name: string, error: string) => {
    messages.push({ role: "tool", tool_call_id: id, content: `Error: ${error}` });
    failures.set(name, (failures.get(name) ?? 0) + 1);
  };

  for (let step = 0; step < MAX_STEPS; step++) {
    const reply = await callModel(messages, { tools: TOOL_DEFS });
    if (reply.toolCalls.length === 0) {
      return finalize(reply.text ?? "", { messages, sources, toolsUsed, question, callModel });
    }

    messages.push({
      role: "assistant",
      content: reply.text,
      tool_calls: reply.toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: tc.rawArgs },
      })),
    });

    for (const tc of reply.toolCalls) {
      let parsed: unknown;
      try {
        parsed = tc.rawArgs.trim() === "" ? {} : JSON.parse(tc.rawArgs);
      } catch {
        parseFailures++;
        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: `Error: the arguments for ${tc.name} could not be parsed as JSON. Send a valid JSON object.`,
        });
        continue;
      }
      const valid = validateArgs(tc.name, parsed);
      if (!valid.ok) {
        fail(tc.id, tc.name, valid.error);
        continue;
      }
      try {
        const result = executeTool(tc.name, valid.args, ctx);
        messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        sources.push({ tool: tc.name, result });
        if (!toolsUsed.includes(tc.name)) toolsUsed.push(tc.name);
      } catch (e) {
        fail(tc.id, tc.name, e instanceof Error ? e.message : "the tool failed");
      }
    }

    // Malformed twice, or the same tool failing twice: stop calling tools.
    if (parseFailures >= 2 || [...failures.values()].some((n) => n >= 2)) break;
  }

  const forced = await callModel([...messages, { role: "user", content: FORCE_ANSWER }], { tools: null });
  return finalize(forced.text ?? "", { messages, sources, toolsUsed, question, callModel });
}

async function finalize(
  text: string,
  run: { messages: ChatMessage[]; sources: ToolSource[]; toolsUsed: string[]; question: string; callModel: CallModel }
): Promise<CoachResult> {
  let answer = tidy(text);
  let check = checkCitations(answer, run.sources, run.question);

  if (check.uncited.length > 0) {
    // One regeneration, then strip whatever still can't be verified.
    const retry = await run.callModel(
      [
        ...run.messages,
        { role: "assistant", content: answer },
        {
          role: "user",
          content: `These figures don't appear in the tool results: ${check.uncited.join(", ")}. Rewrite your answer using only figures from the tool results above, quoted as given.`,
        },
      ],
      { tools: null }
    );
    answer = tidy(retry.text ?? "");
    check = checkCitations(answer, run.sources, run.question);
    if (check.uncited.length > 0) answer = stripUncited(answer, check.uncited);
  }

  // Neutral-wording check for news answers: one rewrite, then a summary
  // assembled from the stories themselves (neutral by construction).
  const usedNews = run.toolsUsed.some((t) => NEWS_TOOLS.has(t));
  if (usedNews) {
    const term = containsNonNeutralAnswer(answer);
    if (term) {
      const retry = await run.callModel(
        [
          ...run.messages,
          { role: "assistant", content: answer },
          {
            role: "user",
            content: `Rewrite neutrally. Remove evaluative or impact words (found: "${term}"). State what happened, the source and date, and which holdings each story touches. No judgments or predictions.`,
          },
        ],
        { tools: null }
      );
      const rewritten = tidy(retry.text ?? "");
      if (containsNonNeutralAnswer(rewritten)) {
        const summary = neutralNewsSummary(run.sources);
        // Asked to judge the news ("is this good for me?"): say why we won't, then the facts.
        answer = containsNonNeutralAnswer(run.question) ? `${NEUTRALITY_LINE}\n\n${summary}` : summary;
      } else {
        answer = rewritten;
      }
      check = checkCitations(answer, run.sources, run.question);
      if (check.uncited.length > 0) answer = stripUncited(answer, check.uncited);
    }
  }

  if (usedNews && hasSampleStory(run.sources) && !answer.includes(SAMPLE_NOTE)) {
    answer = `${answer}\n\n${SAMPLE_NOTE}`;
  }
  const citations = usedNews ? [...new Set([...storyCitations(run.sources), ...check.citations])] : check.citations;

  // The harness owns the disclaimer: exactly one, always the official text.
  return {
    answer: `${answer}\n\n${COACH_DISCLAIMER}`,
    citations,
    toolsUsed: run.toolsUsed,
    source: "live",
    isRefusal: false,
  };
}

const NEWS_TOOLS = new Set(["getMarketBrief", "getHoldingNews"]);

const hasSampleStory = (sources: ToolSource[]) =>
  sources.some(
    (s) => NEWS_TOOLS.has(s.tool) && ((s.result as { stories?: StoryView[] }).stories ?? []).some((x) => x.sample)
  );

/** Facts straight from the news tool results: title, source, date, key points, exposure. */
function neutralNewsSummary(sources: ToolSource[]): string {
  const lines: string[] = [];
  for (const s of sources) {
    if (!NEWS_TOOLS.has(s.tool)) continue;
    const r = s.result as { stories?: StoryView[]; exposure?: string; note?: string };
    if (r.exposure) lines.push(r.exposure);
    for (const story of r.stories ?? []) {
      const tag = story.sample ? "Sample: " : "";
      lines.push(
        [`${tag}${story.title} (${story.source}, ${story.date}).`, ...story.keyPoints, story.touches ?? ""].filter(Boolean).join(" ")
      );
    }
    if (r.note) lines.push(r.note);
  }
  return lines.length > 0 ? lines.join("\n\n") : "There are no stories for this question in your portfolio's news.";
}

/** Plain text for the chat: no Markdown emphasis, no model-written disclaimer. */
function tidy(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/Educational only\b[^\n]*/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
