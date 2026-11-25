import type { DiversificationCheck } from "../../lib/portfolio";
import { Card } from "./Card";

/** SPEC section 4: flags with reasons, one line each. No risk score. */
export function ChecksPanel({ checks }: { checks: DiversificationCheck[] }) {
  return (
    <Card id="checks-heading" title="Diversification check" note="Three concentration checks on your holdings.">
      <ul className="flex flex-col gap-3 text-[14px]">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-3">
            <span
              className={`mt-0.5 shrink-0 rounded-full px-2 py-px text-[12px] font-medium ${
                c.ok ? "border border-stone text-pebble" : "bg-charcoal text-paper"
              }`}
            >
              {c.ok ? "Clear" : "Flag"}
            </span>
            <span>{c.line}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[13px] text-pebble">
        ETFs aren&apos;t counted in the single-stock checks: a fund like VEQT already holds thousands of companies.
      </p>
    </Card>
  );
}
