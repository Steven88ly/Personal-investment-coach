import type { DashboardView } from "../../lib/dashboard";
import { toneClass } from "./tone";

/** Total gain and cash; also total value when there is no scrub hero above. */
export function SummaryStrip({ totals, showValue = true }: { totals: DashboardView["totals"]; showValue?: boolean }) {
  // Under the hero these are secondary figures: smaller, so the hero leads.
  const size = showValue ? "text-[32px]" : "text-[24px]";
  return (
    <section aria-label="Portfolio summary">
      <dl className={`grid grid-cols-1 gap-6 ${showValue ? "sm:grid-cols-3" : "sm:grid-cols-2 md:grid-cols-3"}`}>
        {showValue && (
          <div>
            <dt className="text-[14px] text-pebble">Total value</dt>
            <dd className={`mt-1 font-display ${size} leading-tight tabular-nums`}>{totals.value}</dd>
          </div>
        )}
        <div>
          <dt className="text-[14px] text-pebble">Total gain</dt>
          <dd className={`mt-1 flex flex-wrap items-baseline gap-x-2 tabular-nums ${toneClass(totals.tone)}`}>
            <span className={`font-display ${size} leading-tight`}>{totals.gain}</span>
            <span className="text-[15px] font-medium">{totals.gainPct}</span>
          </dd>
        </div>
        <div>
          <dt className="text-[14px] text-pebble">Cash</dt>
          <dd className={`mt-1 font-display ${size} leading-tight tabular-nums`}>{totals.cash}</dd>
        </div>
      </dl>
    </section>
  );
}
