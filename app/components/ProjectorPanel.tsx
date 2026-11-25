"use client";

import { useState } from "react";
import {
  PROJECTOR_DEFAULTS,
  PROJECTOR_LIMITS,
  clampProjectorInput,
  projectionView,
  type ProjectorInput,
} from "../../lib/projector";

type Field = keyof ProjectorInput;

const FIELDS: { key: Field; id: string; label: string; prefix?: string; suffix?: string }[] = [
  { key: "monthly", id: "projector-monthly", label: "Monthly contribution", prefix: "$" },
  { key: "ratePct", id: "projector-rate", label: "Annual return", suffix: "%" },
  { key: "years", id: "projector-years", label: "Years", suffix: "years" },
];

/** Deposits vs growth: neutral for money put in, the portfolio blue for growth. */
const DEPOSIT_HEX = "#686664";
const GROWTH_HEX = "#1d4ed8";

/**
 * Contribution projector (SPEC section 3). The math is the tested
 * projectContributions, run here so sliders update instantly; the formula
 * is always shown with the current numbers plugged in.
 */
export function ProjectorPanel({ surplusLine }: { surplusLine: string | null }) {
  // Raw text per field so typing isn't fought; clamped values drive the math.
  const [raw, setRaw] = useState<Record<Field, string>>({
    monthly: String(PROJECTOR_DEFAULTS.monthly),
    ratePct: String(PROJECTOR_DEFAULTS.ratePct),
    years: String(PROJECTOR_DEFAULTS.years),
  });
  const input = clampProjectorInput({
    monthly: parseFloat(raw.monthly),
    ratePct: parseFloat(raw.ratePct),
    years: parseFloat(raw.years),
  });
  const view = projectionView(Math.round(input.monthly * 100), input.ratePct, input.years);
  const set = (key: Field, value: string) => setRaw((r) => ({ ...r, [key]: value }));
  const normalize = (key: Field) => set(key, String(input[key]));

  return (
    <section id="projector" aria-labelledby="projector-heading" className="scroll-mt-6 rounded-xl border border-stone bg-paper p-6">
      <h2 id="projector-heading" className="font-display text-[22px] font-semibold leading-snug">
        What monthly contributions become
      </h2>
      {surplusLine && <p className="mt-2 max-w-[72ch] text-[15px]">{surplusLine}</p>}

      <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="flex flex-col gap-6">
          {FIELDS.map(({ key, id, label, prefix, suffix }) => {
            const limits = PROJECTOR_LIMITS[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between gap-4">
                  <label htmlFor={id} className="text-[14px] font-medium">
                    {label}
                  </label>
                  <span className="flex items-center gap-1 rounded-lg border border-stone bg-linen px-2 py-1 text-[14px] tabular-nums focus-within:border-ink">
                    {prefix && <span className="text-pebble">{prefix}</span>}
                    <input
                      id={id}
                      type="number"
                      inputMode="decimal"
                      min={limits.min}
                      max={limits.max}
                      step={limits.step}
                      value={raw[key]}
                      onChange={(e) => set(key, e.target.value)}
                      onBlur={() => normalize(key)}
                      className="w-16 bg-transparent text-right outline-none"
                    />
                    {suffix && <span className="text-pebble">{suffix}</span>}
                  </span>
                </div>
                <input
                  type="range"
                  aria-label={`${label} slider`}
                  min={limits.min}
                  max={limits.max}
                  step={limits.step}
                  value={input[key]}
                  onChange={(e) => set(key, e.target.value)}
                  className="mt-3 w-full accent-ink"
                />
              </div>
            );
          })}
        </div>

        <div aria-live="polite">
          <p className="text-[14px] text-pebble">In {input.years} {input.years === 1 ? "year" : "years"}</p>
          <p className="mt-1 font-display text-[40px] leading-none tabular-nums">{view.futureValue}</p>

          <div className="mt-5 flex h-2.5 w-full gap-[2px] overflow-hidden rounded-full" aria-hidden="true">
            <span className="rounded-l-full" style={{ flexGrow: 1 - view.growthShare, background: DEPOSIT_HEX }} />
            {view.growthShare > 0 && (
              <span className="rounded-r-full" style={{ flexGrow: view.growthShare, background: GROWTH_HEX }} />
            )}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-4 text-[14px] tabular-nums">
            <div>
              <dt className="flex items-center gap-2 text-pebble">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: DEPOSIT_HEX }} aria-hidden="true" />
                You deposit
              </dt>
              <dd className="mt-0.5 font-medium">{view.contributed}</dd>
            </div>
            <div>
              <dt className="flex items-center gap-2 text-pebble">
                <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: GROWTH_HEX }} aria-hidden="true" />
                Growth
              </dt>
              <dd className="mt-0.5 font-medium">{view.growth}</dd>
            </div>
          </dl>

          {view.milestones.length > 1 && (
            <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-1 text-[14px] tabular-nums">
              {view.milestones.map((m) => (
                <li key={m.years}>
                  <span className="text-pebble">After {m.years} years</span> <span className="font-medium">{m.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-stone pt-4">
        <p className="font-display text-[17px]">{view.formula}</p>
        <ul className="mt-1 text-[13px] text-pebble tabular-nums">
          {view.terms.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="mt-2 text-[13px] text-pebble">
          The return is an assumed return, not a prediction: real returns go up and down from year to year.
        </p>
      </div>
    </section>
  );
}
