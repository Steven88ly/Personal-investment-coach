/**
 * Generates data/daily.seed.json: an ILLUSTRATIVE daily portfolio series
 * for the scrub chart. Each month's figure from benchmark.seed.json is hit
 * exactly (Jun 1, then the last trading day of Jul–Oct, then Nov 25); the
 * days in between are a seeded random walk bridged between those anchors.
 * Deterministic: re-running produces the same file. Never cite these
 * in-between values as real — the coach uses the monthly seed only.
 */
import { readFileSync, writeFileSync } from "node:fs";

const SEED = 20261125;
const DAILY_VOL = 0.008;
const HOLIDAYS = new Set(["2026-07-01", "2026-08-03", "2026-09-07", "2026-10-12"]);
const START = "2026-06-01";
const END = "2026-11-25";

const benchmark = JSON.parse(readFileSync(new URL("../data/benchmark.seed.json", import.meta.url)));

function tradingDays(start, end) {
  const days = [];
  for (let d = new Date(`${start}T12:00:00Z`); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (iso > end) break;
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6 && !HOLIDAYS.has(iso)) days.push(iso);
  }
  return days;
}

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);
const gaussian = () => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(2 * Math.PI * rand());

const days = tradingDays(START, END);

// Anchor index per monthly figure: first day for June, last trading day of
// each later month, and the final day for November.
const anchors = benchmark.map((p, i) => {
  if (i === 0) return { index: 0, cents: p.portfolioValueCents };
  if (i === benchmark.length - 1) return { index: days.length - 1, cents: p.portfolioValueCents };
  const inMonth = days.map((d, idx) => [d, idx]).filter(([d]) => d.startsWith(p.month));
  return { index: inMonth.at(-1)[1], cents: p.portfolioValueCents };
});

const values = new Array(days.length);
for (let s = 0; s < anchors.length - 1; s++) {
  const a = anchors[s];
  const b = anchors[s + 1];
  const n = b.index - a.index;
  const walk = [0];
  for (let k = 1; k <= n; k++) walk.push(walk[k - 1] + gaussian() * DAILY_VOL);
  const la = Math.log(a.cents);
  const lb = Math.log(b.cents);
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    const bridge = walk[k] - t * walk[n];
    values[a.index + k] = Math.round(Math.exp(la + (lb - la) * t + bridge));
  }
  values[a.index] = a.cents;
  values[b.index] = b.cents;
}

const series = days.map((date, i) => ({ date, valueCents: values[i] }));
writeFileSync(new URL("../data/daily.seed.json", import.meta.url), JSON.stringify(series) + "\n");
console.log(`wrote ${series.length} days, ${series[0].date} → ${series.at(-1).date}`);
