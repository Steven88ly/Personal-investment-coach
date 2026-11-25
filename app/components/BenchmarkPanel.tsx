import type { BenchmarkView } from "../../lib/dashboard";
import { BenchmarkChart } from "./BenchmarkChart";

const th = "px-3 py-2 text-[13px] font-medium text-pebble";
const td = "px-3 py-2 tabular-nums";

export function BenchmarkPanel({ benchmark }: { benchmark: BenchmarkView }) {
  const first = benchmark.points[0];
  const last = benchmark.points.at(-1)!;
  return (
    <section aria-labelledby="benchmark-heading" className="rounded-xl border border-stone bg-paper p-6">
      <h2 id="benchmark-heading" className="max-w-[32ch] font-display text-[24px] font-semibold leading-snug">
        {benchmark.headline}
      </h2>
      <p className="mt-1 text-[13px] text-pebble">
        Percent change since {first.label} {first.month.slice(0, 4)}, month by month to {last.label}. Mock data.
      </p>

      <div className="mt-6">
        <BenchmarkChart points={benchmark.points} label={benchmark.summary} />
      </div>

      <p className="mt-4 text-[15px] font-medium tabular-nums">{benchmark.summary}</p>
      <p className="mt-1 max-w-[80ch] text-[13px] text-pebble">
        The portfolio line tracks total value, so it includes any money you added. VEQT is its share price.
      </p>

      <details className="mt-4 text-[14px]">
        <summary className="cursor-pointer select-none font-medium underline decoration-stone underline-offset-4">
          Show the numbers
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table aria-label="Portfolio vs VEQT by month" className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className="border-b border-stone text-right">
                <th scope="col" className={`${th} text-left`}>Month</th>
                <th scope="col" className={th}>Portfolio value</th>
                <th scope="col" className={th}>Change</th>
                <th scope="col" className={th}>VEQT price</th>
                <th scope="col" className={th}>Change</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.points.map((p) => (
                <tr key={p.month} className="text-right odd:bg-linen">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {p.label} {p.month.slice(0, 4)}
                  </th>
                  <td className={td}>{p.portfolioValue}</td>
                  <td className={td}>{p.portfolioChange}</td>
                  <td className={td}>{p.veqtPrice}</td>
                  <td className={td}>{p.veqtChange}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}
