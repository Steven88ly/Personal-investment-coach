import type { HoldingRow } from "../../lib/dashboard";
import { Card, NotApplicable } from "./Card";
import { toneClass } from "./tone";

const th = "px-3 py-2 text-[13px] font-medium text-pebble";
const td = "px-3 py-3 tabular-nums";

export function HoldingsTable({ rows, asOf }: { rows: HoldingRow[]; asOf: string }) {
  return (
    <Card id="holdings-heading" title="Holdings" note={`Illustrative prices as of ${asOf}.`}>
      <div className="-mx-6 overflow-x-auto px-6">
        <table aria-label="Holdings" className="w-full min-w-[720px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-stone text-right">
              <th scope="col" className={`${th} text-left`}>Holding</th>
              <th scope="col" className={th}>Shares</th>
              <th scope="col" className={th}>Avg cost</th>
              <th scope="col" className={th}>Price</th>
              <th scope="col" className={th}>Value</th>
              <th scope="col" className={th}>Gain / loss</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="text-right odd:bg-linen">
                <th scope="row" className="px-3 py-3 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className="font-semibold">{r.ticker}</span>
                    <span className="rounded-full border border-stone px-2 py-px text-[12px] text-pebble">{r.account}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-pebble">{r.name}</span>
                </th>
                <td className={td}>{r.shares ?? <NotApplicable />}</td>
                <td className={td}>{r.avgCost ?? <NotApplicable />}</td>
                <td className={td}>{r.price ?? <NotApplicable />}</td>
                <td className={`${td} font-medium`}>{r.value}</td>
                <td className={`${td} ${toneClass(r.tone)}`}>
                  {r.gain === null ? (
                    <NotApplicable />
                  ) : (
                    <>
                      <span className="block">{r.gain}</span>
                      <span className="block text-[13px]">{r.gainPct}</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
