"use client";

import { useState } from "react";
import type { AllocationSlice } from "../../lib/dashboard";
import { donutArcs } from "../../lib/donut";
import { SLICE_COLORS } from "./sliceColors";

const R = 88;
const INNER = 60;

export function AllocationDonut({ slices, total }: { slices: AllocationSlice[]; total: string }) {
  const [active, setActive] = useState<number | null>(null);
  const arcs = donutArcs(
    slices.map((s) => s.share),
    R,
    INNER
  );
  const shown = active === null ? null : slices[active];
  const label = `Allocation by asset class: ${slices.map((s) => `${s.label} ${s.pct}`).join(", ")}`;

  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`${-R - 2} ${-R - 2} ${2 * R + 4} ${2 * R + 4}`}
      className="mx-auto block h-[184px] w-[184px]"
      onPointerLeave={() => setActive(null)}
    >
      {arcs.map((arc) => {
        const slice = slices[arc.index];
        return (
          <path
            key={slice.label}
            data-slice={slice.label}
            d={arc.d}
            fill={SLICE_COLORS[slice.label] ?? "#686664"}
            stroke="#fcfcfc"
            strokeWidth={2}
            opacity={active === null || active === arc.index ? 1 : 0.35}
            className="transition-opacity duration-150"
            onPointerEnter={() => setActive(arc.index)}
          />
        );
      })}
      <text textAnchor="middle" className="fill-pebble text-[12px]" y={-18}>
        {shown ? shown.label : "Total"}
      </text>
      <text textAnchor="middle" className="fill-ink font-display text-[19px] tabular-nums" y={6}>
        {shown ? shown.value : total}
      </text>
      {shown && (
        <text textAnchor="middle" className="fill-pebble text-[13px] tabular-nums" y={26}>
          {shown.pct}
        </text>
      )}
    </svg>
  );
}
