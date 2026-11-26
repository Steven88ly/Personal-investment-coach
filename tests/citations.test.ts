import { describe, expect, it } from "vitest";
import { checkCitations, stripUncited } from "../lib/citations";

const sources = [
  { tool: "getPortfolioSummary", result: { totalValue: "$19,182.00", gain: "+$1,572.00", gainPct: "+8.93%" } },
  { tool: "projectContributions", result: { futureValue: "$34,616.96", contributed: "$24,000.00" } },
  { tool: "getBenchmarkComparison", result: { differencePp: "+5.24pp" } },
];

describe("checkCitations", () => {
  it("accepts figures that match a tool result exactly or at the precision written", () => {
    const r = checkCitations(
      "You're at $19,182.00, up $1,572 (8.9%). $200/mo becomes $34,617, ahead by 5.2 percentage points.",
      sources,
      "What does $200 a month become?"
    );
    expect(r.uncited).toEqual([]);
  });

  it("lists each supporting figure as a readable citation, once", () => {
    const r = checkCitations("Worth $19,182.00, or $19,182 rounded.", sources, "");
    expect(r.citations).toEqual(["Portfolio summary: total value $19,182.00"]);
  });

  it("flags a dollar figure or percentage that no tool returned", () => {
    const r = checkCitations("You have $50,000.00 and gained 12%.", sources, "");
    expect(r.uncited).toEqual(["$50,000.00", "12%"]);
  });

  it("allows numbers the user supplied in the question", () => {
    expect(checkCitations("At 7% a month of $200…", sources, "$200 a month at 7%?").uncited).toEqual([]);
  });

  it("ignores numbers that aren't money or percentages", () => {
    expect(checkCitations("In 10 years, as of Nov 25, 2026.", sources, "").uncited).toEqual([]);
  });
});

describe("citations from news stories", () => {
  it("cite a story by its title and date, not by quoting its long text", () => {
    const news = [
      {
        tool: "getMarketBrief",
        result: {
          stories: [
            {
              title: "Broad global selloff hits equities as AI trade unwinds",
              source: "Market brief — Nov 20, 2026 selloff (verified)",
              date: "Nov 20, 2026",
              summary: "VEQT fell to about $57.50 midday, down ~2.2% from the $58.82 prior close and ~7.9% over five sessions.",
              touches: "Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00).",
            },
          ],
        },
      },
    ];
    const r = checkCitations("VEQT fell to about $57.50, down 2.2%. This touches 59.2% ($11,352.00).", news, "");
    expect(r.uncited).toEqual([]);
    expect(r.citations).toEqual([
      "Market brief: Broad global selloff hits equities as AI trade unwinds (Market brief — Nov 20, 2026 selloff (verified), Nov 20, 2026)",
      "Market brief: Touches VEQT, VFV, XEQT: 59.2% of your portfolio ($11,352.00).",
    ]);
  });
});

describe("stripUncited", () => {
  it("removes each unverified figure and says so", () => {
    expect(stripUncited("You have $50,000.00 and gained 12%.", ["$50,000.00", "12%"])).toBe(
      "You have [figure removed: not in your data] and gained [figure removed: not in your data].\n\n" +
        "Some figures couldn't be verified against your portfolio data and were removed."
    );
  });
});
