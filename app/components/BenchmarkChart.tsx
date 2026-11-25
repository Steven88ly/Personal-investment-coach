"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { BenchmarkView } from "../../lib/dashboard";

type Point = BenchmarkView["points"][number];

/** Validated pair on the paper surface (dataviz validator: all checks pass). */
const SERIES = {
  portfolio: { name: "Portfolio", color: "#1d4ed8", dash: undefined },
  veqt: { name: "VEQT", color: "#b45309", dash: "6 4" },
} as const;

const HEIGHT = 260;
const M = { top: 16, right: 88, bottom: 32, left: 44 };
const STEPS = [0.01, 0.02, 0.025, 0.04, 0.05, 0.1, 0.2];

function niceScale(values: number[]) {
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const step = STEPS.find((s) => (hi - lo) / s <= 4) ?? 0.25;
  const min = Math.floor(lo / step) * step;
  const max = Math.max(step, Math.ceil(hi / step) * step);
  const ticks: number[] = [];
  for (let t = min; t <= max + 1e-9; t += step) ticks.push(Number(t.toFixed(4)));
  return { min, max, ticks };
}

function tickLabel(t: number) {
  const pct = Math.round(t * 1000) / 10;
  if (pct === 0) return "0%";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

/** Keep the two end labels at least `gap` px apart. */
function separate(a: number, b: number, gap = 34): [number, number] {
  if (Math.abs(a - b) >= gap) return [a, b];
  const mid = (a + b) / 2;
  return a <= b ? [mid - gap / 2, mid + gap / 2] : [mid + gap / 2, mid - gap / 2];
}

export function BenchmarkChart({ points, label }: { points: Point[]; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const plotW = width - M.left - M.right;
  const plotH = HEIGHT - M.top - M.bottom;
  const { min, max, ticks } = niceScale(points.flatMap((p) => [p.portfolioPct, p.veqtPct]));
  const x = (i: number) => M.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => M.top + ((max - v) / (max - min)) * plotH;
  const path = (key: "portfolioPct" | "veqtPct") =>
    points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");

  const last = points.length - 1;
  const [portfolioLabelY, veqtLabelY] = separate(y(points[last].portfolioPct), y(points[last].veqtPct));

  function onMove(e: PointerEvent<SVGRectElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - box.left) / box.width) * plotW;
    const i = Math.round((rel / plotW) * last);
    setActive(Math.min(last, Math.max(0, i)));
  }

  const hovered = active === null ? null : points[active];
  const tooltipLeft = active === null ? 0 : Math.min(Math.max(x(active), 96), width - 96);

  return (
    <div ref={wrap} className="relative w-full">
      <svg
        role="img"
        aria-label={`Line chart of % change since ${points[0].label}: ${label}`}
        width={width}
        height={HEIGHT}
        viewBox={`0 0 ${width} ${HEIGHT}`}
        className="block max-w-full overflow-visible"
      >
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={M.left}
              x2={M.left + plotW}
              y1={y(t)}
              y2={y(t)}
              stroke={t === 0 ? "#C9C6C4" : "#E4E2E1"}
              strokeWidth={1}
            />
            <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-pebble text-[12px] tabular-nums">
              {tickLabel(t)}
            </text>
          </g>
        ))}

        {points.map((p, i) => (
          <text key={p.month} x={x(i)} y={HEIGHT - 8} textAnchor="middle" className="fill-pebble text-[12px]">
            {p.label}
          </text>
        ))}

        {hovered && active !== null && (
          <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + plotH} stroke="#686664" strokeWidth={1} />
        )}

        {(["veqt", "portfolio"] as const).map((key) => {
          const s = SERIES[key];
          const field = key === "portfolio" ? "portfolioPct" : "veqtPct";
          return (
            <g key={key}>
              <path
                data-series={key}
                d={path(field)}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              <circle cx={x(last)} cy={y(points[last][field])} r={4} fill={s.color} stroke="#FCFCFC" strokeWidth={2} />
              {active !== null && (
                <circle cx={x(active)} cy={y(points[active][field])} r={4} fill={s.color} stroke="#FCFCFC" strokeWidth={2} />
              )}
            </g>
          );
        })}

        {(
          [
            ["portfolio", portfolioLabelY, points[last].portfolioChange],
            ["veqt", veqtLabelY, points[last].veqtChange],
          ] as const
        ).map(([key, ly, value]) => (
          <text key={key} x={M.left + plotW + 12} y={ly} className="text-[13px] tabular-nums">
            <tspan x={M.left + plotW + 12} dy="-0.1em" className="fill-ink font-medium">{SERIES[key].name}</tspan>
            <tspan x={M.left + plotW + 12} dy="1.25em" className="fill-pebble">{value}</tspan>
          </text>
        ))}

        <rect
          x={M.left}
          y={M.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {hovered && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 w-[184px] -translate-x-1/2 rounded-lg border border-stone bg-paper px-3 py-2 text-[13px] tabular-nums"
          style={{ left: tooltipLeft }}
        >
          <p className="font-medium">
            {hovered.label} {hovered.month.slice(0, 4)}
          </p>
          {(
            [
              ["portfolio", hovered.portfolioValue, hovered.portfolioChange],
              ["veqt", hovered.veqtPrice, hovered.veqtChange],
            ] as const
          ).map(([key, amount, change]) => (
            <p key={key} className="mt-1 flex items-center gap-2">
              <svg width="14" height="4" aria-hidden="true">
                <line x1="0" x2="14" y1="2" y2="2" stroke={SERIES[key].color} strokeWidth="2" strokeDasharray={SERIES[key].dash} />
              </svg>
              <span>{SERIES[key].name}</span>
              <span className="ml-auto text-pebble">{amount}</span>
              <span className="w-12 text-right">{change}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
