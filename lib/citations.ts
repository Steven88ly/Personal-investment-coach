/**
 * Citation check (AGENT.md §5): every dollar figure and percentage in an
 * answer must match a figure a tool returned in this run, or a number the
 * user gave in the question. "Show your work" is enforced, not hoped for.
 *
 * A figure matches when the tool's value, rounded to the precision the
 * answer wrote it at, is equal: "$34,617" matches "$34,616.96", "8.9%"
 * matches "+8.93%". Signs are ignored (the words carry direction).
 */

export interface ToolSource {
  tool: string;
  result: unknown;
}

type Kind = "money" | "percent";

interface Figure {
  text: string;
  kind: Kind;
  value: number;
  decimals: number;
  /** Position in the text, so figures are reported in reading order. */
  index: number;
}

interface SourceFigure {
  kind: Kind;
  value: number;
  label: string;
}

const TOOL_LABELS: Record<string, string> = {
  getPortfolioSummary: "Portfolio summary",
  getHoldings: "Holdings",
  getAllocation: "Allocation",
  getBenchmarkComparison: "Benchmark vs VEQT",
  getDiversificationFlags: "Diversification checks",
  projectContributions: "Projection",
  getMarketBrief: "Market brief",
  getHoldingNews: "Holding news",
};

const MONEY = /[+−-]?\$\s?\d[\d,]*(?:\.\d+)?/g;
const PERCENT = /[+−-]?\d+(?:\.\d+)?\s?(?:%|pp\b|percentage points?\b)/g;

function figuresIn(text: string): Figure[] {
  const out: Figure[] = [];
  for (const [re, kind] of [
    [MONEY, "money"],
    [PERCENT, "percent"],
  ] as const) {
    for (const m of text.matchAll(re)) {
      const digits = m[0].replace(/[^\d.]/g, "").replace(/\.$/, "");
      out.push({
        text: m[0].trim(),
        kind,
        value: Math.abs(Number(digits)),
        decimals: digits.includes(".") ? digits.split(".")[1].length : 0,
        index: m.index ?? 0,
      });
    }
  }
  return out.sort((a, b) => a.index - b.index);
}

const humanize = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();

/** Story text (summary, key points) is cited by the story, not quoted whole. */
const STORY_TEXT_KEYS = new Set(["title", "summary", "keyPoints"]);

function collect(
  tool: string,
  node: unknown,
  key: string,
  ticker: string | null,
  out: SourceFigure[],
  story: string | null = null
) {
  const toolLabel = TOOL_LABELS[tool] ?? tool;
  if (typeof node === "string") {
    for (const f of figuresIn(node)) {
      const who = ticker ? `${ticker} ` : "";
      const field = node.toLowerCase().startsWith(humanize(key)) ? "" : `${humanize(key)} `;
      const label = story && STORY_TEXT_KEYS.has(key) ? `${toolLabel}: ${story}` : `${toolLabel}: ${who}${field}${node}`;
      out.push({ kind: f.kind, value: f.value, label });
    }
  } else if (Array.isArray(node)) {
    for (const item of node) collect(tool, item, key, ticker, out, story);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = typeof obj.ticker === "string" ? obj.ticker : ticker;
    const s = storyLabel(obj) ?? story;
    for (const [k, v] of Object.entries(obj)) collect(tool, v, k, t, out, s);
  }
}

/** "Title (Source, Date)" for a story-shaped object, else null. */
function storyLabel(obj: Record<string, unknown>): string | null {
  if (typeof obj.title !== "string" || typeof obj.date !== "string") return null;
  return typeof obj.source === "string" ? `${obj.title} (${obj.source}, ${obj.date})` : `${obj.title} (${obj.date})`;
}

/** One citation per story a news tool returned, whether or not the answer quoted its figures. */
export function storyCitations(sources: ToolSource[]): string[] {
  const out: string[] = [];
  for (const s of sources) {
    const stories = (s.result as { stories?: Record<string, unknown>[] } | null)?.stories ?? [];
    for (const story of stories) {
      const label = storyLabel(story);
      const full = label && `${TOOL_LABELS[s.tool] ?? s.tool}: ${label}`;
      if (full && !out.includes(full)) out.push(full);
    }
  }
  return out;
}

const matches = (f: Figure, value: number) => Number(value.toFixed(f.decimals)) === f.value;

export function checkCitations(
  answer: string,
  sources: ToolSource[],
  question: string
): { uncited: string[]; citations: string[] } {
  const known: SourceFigure[] = [];
  for (const s of sources) collect(s.tool, s.result, "", null, known);
  const fromQuestion = [...question.matchAll(/\d[\d,]*(?:\.\d+)?/g)].map((m) => Number(m[0].replace(/,/g, "")));

  const uncited: string[] = [];
  const citations: string[] = [];
  for (const f of figuresIn(answer)) {
    const source = known.find((k) => k.kind === f.kind && matches(f, k.value));
    if (source) {
      if (!citations.includes(source.label)) citations.push(source.label);
    } else if (!fromQuestion.some((v) => matches(f, v))) {
      uncited.push(f.text);
    }
  }
  return { uncited, citations };
}

export const REMOVED = "[figure removed: not in your data]";

export function stripUncited(answer: string, uncited: string[]): string {
  let out = answer;
  for (const figure of uncited) out = out.split(figure).join(REMOVED);
  return `${out}\n\nSome figures couldn't be verified against your portfolio data and were removed.`;
}
