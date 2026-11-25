"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { RANGES, heroReadout, indexAtX, nextIndex, sliceRange, type Range } from "../../lib/daily";
import type { Tone } from "../../lib/format";
import type { DailyPoint } from "../../lib/types";

const HEIGHT = 220;
const PAD_Y = 14;
const TONE_HEX: Record<Tone, string> = { gain: "#15803d", loss: "#b91c1c", flat: "#686664" };
const TONE_TEXT: Record<Tone, string> = { gain: "text-gain", loss: "text-loss", flat: "text-pebble" };
const NAV_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/**
 * Wealthsimple-style hero: big value, change line, and a daily line you can
 * drag across (mouse, touch, or arrow keys). Values between month-ends are
 * generated mock data; the change includes money added, so it's "change in
 * value", not gain.
 */
export function PortfolioHero({ daily }: { daily: DailyPoint[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [range, setRange] = useState<Range>("All");
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(240, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => sliceRange(daily, range), [daily, range]);
  const last = points.length - 1;
  const readout = heroReadout(points, active);
  const rangeTone = heroReadout(points, null).tone;

  const values = points.map((p) => p.valueCents);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const x = (i: number) => (last === 0 ? width / 2 : (i / last) * width);
  const y = (v: number) => PAD_Y + ((hi - v) / span) * (HEIGHT - 2 * PAD_Y);
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valueCents).toFixed(1)}`).join(" ");
  const baseline = y(points[0].valueCents);

  function scrubTo(e: PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    setActive(indexAtX(e.clientX - box.left, box.width, points.length));
  }

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    if (!NAV_KEYS.has(e.key)) return;
    e.preventDefault();
    setActive(nextIndex(active, e.key, points.length));
  }

  function pickRange(r: Range) {
    setRange(r);
    setActive(null);
  }

  const shown = active ?? last;

  return (
    <section aria-label="Portfolio value">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[14px] text-pebble">Portfolio value on {readout.date}</p>
          <p className="mt-1 font-display text-[40px] leading-none tabular-nums">{readout.value}</p>
          <p className={`mt-2 text-[15px] font-medium tabular-nums ${TONE_TEXT[readout.tone]}`}>
            {readout.change} ({readout.changePct}){" "}
            <span className="font-normal text-pebble">
              change in value, {readout.startDate} to {readout.date}
            </span>
          </p>
        </div>
        <div role="group" aria-label="Chart range" className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => pickRange(r)}
              className={`rounded-full px-3 py-1 text-[13px] font-medium transition-colors duration-150 ${
                r === range ? "bg-charcoal text-paper" : "border border-ink/70 hover:bg-stone/60"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={wrap}
        role="slider"
        tabIndex={0}
        aria-label="Portfolio value by day"
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={shown}
        aria-valuetext={`${readout.date}: ${readout.value}, ${readout.change} (${readout.changePct}) since ${readout.startDate}`}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="mt-6 w-full rounded-md"
      >
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          className="block max-w-full cursor-crosshair touch-pan-y"
          aria-hidden="true"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrubTo(e);
          }}
          onPointerMove={scrubTo}
          onPointerLeave={() => setActive(null)}
          onPointerCancel={() => setActive(null)}
        >
          <line x1={0} x2={width} y1={baseline} y2={baseline} stroke="#c9c6c4" strokeWidth={1} strokeDasharray="2 4" />
          <path d={path} fill="none" stroke={TONE_HEX[rangeTone]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {active !== null && (
            <>
              <line x1={x(active)} x2={x(active)} y1={0} y2={HEIGHT} stroke="#32302f" strokeWidth={1} />
              <circle
                cx={x(active)}
                cy={y(points[active].valueCents)}
                r={4}
                fill={TONE_HEX[rangeTone]}
                stroke="#fcfcfc"
                strokeWidth={2}
              />
            </>
          )}
        </svg>
      </div>

      <p className="mt-2 text-[12px] text-pebble">
        Drag across the chart or use the arrow keys to see any day. Daily values between month-ends are generated mock
        data.
      </p>
    </section>
  );
}
