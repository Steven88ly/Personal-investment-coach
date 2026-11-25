import { describe, expect, it } from "vitest";
import { donutArcs } from "../lib/donut";

const TAU = Math.PI * 2;
const seedShares = [1135200 / 1918200, 633000 / 1918200, 150000 / 1918200];

describe("donutArcs", () => {
  it("seed allocation: 3 contiguous arcs from 12 o'clock round to a full turn", () => {
    const arcs = donutArcs(seedShares, 50, 32);
    expect(arcs).toHaveLength(3);
    expect(arcs[0].start).toBe(0);
    expect(arcs.at(-1)!.end).toBeCloseTo(TAU, 10);
    for (let i = 1; i < arcs.length; i++) {
      expect(arcs[i].start).toBeCloseTo(arcs[i - 1].end, 10);
    }
  });

  it("a single 100% class draws a full ring (two arc commands per edge)", () => {
    const [arc] = donutArcs([1], 50, 32);
    expect(arc.d.match(/A/g)!.length).toBeGreaterThanOrEqual(4);
  });

  it("skips zero shares", () => {
    expect(donutArcs([0.5, 0, 0.5], 50, 32)).toHaveLength(2);
  });

  it("each arc keeps the index of the share it came from, even after a skipped zero", () => {
    expect(donutArcs([0.9, 0, 0.1], 50, 32).map((a) => a.index)).toEqual([0, 2]);
  });

  it("never produces NaN", () => {
    for (const arc of [...donutArcs(seedShares, 50, 32), ...donutArcs([1], 50, 32)]) {
      expect(arc.d).not.toContain("NaN");
    }
  });
});
