import type { AllocationSlice, HoldingSlice } from "../../lib/dashboard";
import { AllocationDonut } from "./AllocationDonut";
import { SLICE_COLORS } from "./sliceColors";
import { Card } from "./Card";

const row = "border-b border-stone last:border-b-0";
const cell = "py-2 tabular-nums";

export function AllocationPanel({
  byAssetClass,
  byHolding,
  total,
}: {
  byAssetClass: AllocationSlice[];
  byHolding: HoldingSlice[];
  total: string;
}) {
  return (
    <Card id="allocation-heading" title="Allocation" note="Share of total portfolio value.">
      <div className="grid grid-cols-1 items-start gap-8 text-[14px] md:grid-cols-2">
        <div className="flex flex-col gap-6">
          <AllocationDonut slices={byAssetClass} total={total} />
          <table aria-label="Allocation by asset class" className="w-full border-collapse">
          <caption className="pb-2 text-left text-[15px] font-semibold">By asset class</caption>
          <tbody>
            {byAssetClass.map((s) => (
              <tr key={s.label} className={row}>
                <th scope="row" className="py-2 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: SLICE_COLORS[s.label] }}
                    />
                    {s.label}
                  </span>
                </th>
                <td className={`${cell} text-right text-pebble`}>{s.value}</td>
                <td className={`${cell} w-20 text-right font-medium`}>{s.pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
        <table aria-label="Allocation by holding" className="w-full border-collapse">
          <caption className="pb-2 text-left text-[15px] font-semibold">By holding</caption>
          <tbody>
            {byHolding.map((h) => (
              <tr key={h.ticker} className={row}>
                <th scope="row" className="py-2 text-left font-normal">
                  <span className="font-semibold">{h.ticker}</span>{" "}
                  <span className="text-pebble">{h.name}</span>
                </th>
                <td className={`${cell} w-20 text-right font-medium`}>{h.pct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
