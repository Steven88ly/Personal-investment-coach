/**
 * Ring-segment geometry for the allocation donut, centred on (0, 0).
 * Angles are radians from 12 o'clock, clockwise. Every edge is drawn as two
 * half-arcs, so a single 100% slice still closes into a full ring (one SVG
 * arc command can't draw a whole circle).
 */

export interface DonutArc {
  /** Position of the share this arc draws, in the input array (zeros are skipped). */
  index: number;
  d: string;
  start: number;
  end: number;
}

const point = (radius: number, angle: number) =>
  `${(radius * Math.sin(angle)).toFixed(3)} ${(-radius * Math.cos(angle)).toFixed(3)}`;

function segment(r: number, inner: number, start: number, end: number): string {
  const mid = (start + end) / 2;
  return [
    `M${point(r, start)}`,
    `A${r} ${r} 0 0 1 ${point(r, mid)}`,
    `A${r} ${r} 0 0 1 ${point(r, end)}`,
    `L${point(inner, end)}`,
    `A${inner} ${inner} 0 0 0 ${point(inner, mid)}`,
    `A${inner} ${inner} 0 0 0 ${point(inner, start)}`,
    "Z",
  ].join(" ");
}

export function donutArcs(shares: number[], r: number, inner: number): DonutArc[] {
  const total = shares.reduce((s, x) => s + x, 0);
  if (total <= 0) return [];
  const arcs: DonutArc[] = [];
  let angle = 0;
  for (const [index, share] of shares.entries()) {
    if (share <= 0) continue;
    const sweep = (share / total) * Math.PI * 2;
    arcs.push({ index, d: segment(r, inner, angle, angle + sweep), start: angle, end: angle + sweep });
    angle += sweep;
  }
  return arcs;
}
