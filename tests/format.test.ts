import { describe, expect, it } from "vitest";
import {
  formatAsOf,
  formatDay,
  formatMoney,
  formatMonth,
  formatPct,
  formatSignedMoney,
  formatSignedPct,
  toneOf,
} from "../lib/format";

const MINUS = "−";

describe("money formatting (CAD, 2 decimals)", () => {
  it("formats cents with commas", () => {
    expect(formatMoney(1918200)).toBe("$19,182.00");
    expect(formatMoney(0)).toBe("$0.00");
  });

  it("signs gains and losses; zero has no sign", () => {
    expect(formatSignedMoney(157200)).toBe("+$1,572.00");
    expect(formatSignedMoney(-1200)).toBe(`${MINUS}$12.00`);
    expect(formatSignedMoney(0)).toBe("$0.00");
  });
});

describe("percent formatting (1 decimal)", () => {
  it("formats a 0–1 fraction as a percent", () => {
    expect(formatPct(690000 / 1918200)).toBe("36.0%");
  });

  it("signs a change; values that round to zero show no sign", () => {
    expect(formatSignedPct(157200 / 1761000)).toBe("+8.9%");
    expect(formatSignedPct(-0.05)).toBe(`${MINUS}5.0%`);
    expect(formatSignedPct(-0.0004)).toBe("0.0%");
    expect(formatSignedPct(0)).toBe("0.0%");
  });
});

describe("dates", () => {
  it("formats the price as-of date", () => {
    expect(formatAsOf("2026-11-25")).toBe("Nov 25, 2026");
  });

  it("formats a trading day", () => {
    expect(formatDay("2026-08-14")).toBe("Aug 14, 2026");
  });

  it("formats a benchmark month as its short name", () => {
    expect(formatMonth("2026-06")).toBe("Jun");
    expect(formatMonth("2026-11")).toBe("Nov");
  });
});

describe("tone", () => {
  it("classifies a change as gain, loss, or flat", () => {
    expect(toneOf(1)).toBe("gain");
    expect(toneOf(-1)).toBe("loss");
    expect(toneOf(0)).toBe("flat");
  });
});
