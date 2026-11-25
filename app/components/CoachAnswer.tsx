export interface CoachAnswerProps {
  question: string;
  answer: string;
  citations: string[];
  toolsUsed: string[];
  source: "live" | "pre-check" | "rule-based fallback";
  isRefusal: boolean;
}

/** The disclaimer the harness appends to every answer starts with this. */
const DISCLAIMER_START = "Educational only";

/**
 * One question and its answer. Sources sit under every answer and the
 * disclaimer under that. A refusal renders exactly like any other answer:
 * refusing advice is normal here, not an error (DESIGN.md "States").
 */
export function CoachAnswer({ question, answer, citations, source }: CoachAnswerProps) {
  const cut = answer.lastIndexOf(DISCLAIMER_START);
  const body = (cut >= 0 ? answer.slice(0, cut) : answer).trim();
  const disclaimer = cut >= 0 ? answer.slice(cut).trim() : null;

  return (
    <li className="flex flex-col gap-3">
      <p className="self-end rounded-2xl bg-linen px-4 py-2 text-[15px]">{question}</p>
      <div className="rounded-xl border border-stone bg-paper px-4 py-3">
        {source === "rule-based fallback" && (
          <p className="mb-2 inline-block rounded-full border border-stone px-2 py-px text-[12px] text-pebble">
            Rule-based answer — live coach unavailable
          </p>
        )}
        <div className="flex flex-col gap-2 text-[15px] leading-relaxed">
          {body.split(/\n{2,}/).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
        {citations.length > 0 && (
          <div className="mt-3 border-t border-stone pt-2">
            <p className="text-[12px] font-medium text-pebble">Sources</p>
            <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-pebble tabular-nums">
              {citations.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}
        {disclaimer && <p className="mt-3 text-[12px] text-pebble">{disclaimer}</p>}
      </div>
    </li>
  );
}
