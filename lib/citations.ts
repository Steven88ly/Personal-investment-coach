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

function collect(tool: string, node: unknown, key: string, ticker: string | null, out: SourceFigure[]) {
  if (typeof node === "string") {
    for (const f of figuresIn(node)) {
      const who = ticker ? `${ticker} ` : "";
      out.push({ kind: f.kind, value: f.value, label: `${TOOL_LABELS[tool] ?? tool}: ${who}${humanize(key)} ${node}` });
    }
  } else if (Array.isArray(node)) {
    for (const item of node) collect(tool, item, key, ticker, out);
  } else if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = typeof obj.ticker === "string" ? obj.ticker : ticker;
    for (const [k, v] of Object.entries(obj)) collect(tool, v, k, t, out);
  }
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
