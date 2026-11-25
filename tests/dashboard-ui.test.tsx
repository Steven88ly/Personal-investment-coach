import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AllocationDonut } from "../app/components/AllocationDonut";
import { Dashboard } from "../app/components/Dashboard";
import { SLICE_COLORS } from "../app/components/sliceColors";
import { buildDashboard } from "../lib/dashboard";
import type { BenchmarkPoint, DailyPoint, Holding, Transaction } from "../lib/types";
import transactionsSeed from "../data/transactions.seed.json";
import dailySeed from "../data/daily.seed.json";
import benchmarkSeed from "../data/benchmark.seed.json";
import holdingsSeed from "../data/holdings.seed.json";

const holdings = holdingsSeed as Holding[];
const benchmark = benchmarkSeed as BenchmarkPoint[];
const daily = dailySeed as DailyPoint[];
const txns = transactionsSeed as Transaction[];
const html = renderToStaticMarkup(<Dashboard view={buildDashboard(holdings, benchmark, daily, txns)} />);

/** Text content with tags stripped and entities for apostrophes decoded. */
const text = html
  .replace(/<[^>]+>/g, " ")
  .replace(/&#x27;|&#39;/g, "'")
  .replace(/\s+/g, " ");

describe("dashboard header", () => {
  it("always shows the mock-data badge with its as-of date", () => {
    expect(text).toContain("Mock data — as of Nov 25, 2026");
  });

  it("shows the educational-only disclaimer", () => {
    expect(text).toMatch(/not financial advice/i);
  });
});

describe("portfolio hero (scrub chart)", () => {
  const hero = html.match(/<section[^>]*aria-label="Portfolio value"[\s\S]*?<\/section>/)?.[0] ?? "";
  const heroText = hero.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  it("shows the latest value and the change since Jun 1 for the All range", () => {
    expect(heroText).toContain("$19,182.00");
    expect(heroText).toContain("+$1,982.00");
    expect(heroText).toContain("+11.5%");
    expect(heroText).toContain("Jun 1, 2026");
  });

  it("has 1M / 3M / All range buttons with All pressed", () => {
    for (const r of ["1M", "3M", "All"]) {
      expect(hero).toMatch(new RegExp(`<button[^>]*>${r}</button>`));
    }
    expect(hero).toMatch(/<button[^>]*aria-pressed="true"[^>]*>All<\/button>/);
  });

  it("exposes the chart as a keyboard slider over the 124 days", () => {
    const slider = hero.match(/<[^>]*role="slider"[^>]*>/)?.[0] ?? "";
    expect(slider).toContain('aria-valuemin="0"');
    expect(slider).toContain('aria-valuemax="123"');
    expect(slider).toContain('aria-valuenow="123"');
    expect(slider).toMatch(/aria-valuetext="[^"]*Nov 25, 2026[^"]*\$19,182\.00/);
  });

  it("calls it a change in value and labels it mock", () => {
    expect(heroText).toMatch(/change in value/i);
    expect(heroText).toMatch(/mock/i);
  });
});

describe("portfolio summary strip", () => {
  it("shows total value, total gain with $ and %, and cash", () => {
    expect(text).toContain("$19,182.00");
    expect(text).toContain("+$1,572.00");
    expect(text).toContain("+8.9%");
    expect(text).toContain("$1,500.00");
  });
});

describe("holdings table", () => {
  const tbody = html.match(/<table[^>]*aria-label="Holdings"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";

  it("has one row per holding, cash included", () => {
    expect(tbody.match(/<tr/g)).toHaveLength(7);
  });

  it("tags each holding with its account", () => {
    expect(tbody.match(/>TFSA</g)).toHaveLength(3);
    expect(tbody.match(/>RRSP</g)).toHaveLength(1);
    expect(tbody.match(/>non-registered</g)).toHaveLength(3);
  });

  it("shows VEQT's gain in $ and % together", () => {
    expect(tbody).toContain("+$660.00");
    expect(tbody).toContain("+10.6%");
  });
});

describe("allocation", () => {
  it("breaks down by asset class with exact percentages", () => {
    expect(text).toMatch(/ETFs \$11,352\.00 59\.2%/);
    expect(text).toMatch(/Stocks \$6,330\.00 33\.0%/);
    expect(text).toMatch(/Cash \$1,500\.00 7\.8%/);
  });

  it("breaks down by holding", () => {
    expect(text).toMatch(/VEQT[^%]*36\.0%/);
  });

  it("draws a donut of the three asset classes, labelled for screen readers", () => {
    const svg = html.match(/<svg[^>]*aria-label="Allocation by asset class:[^"]*"[^>]*>/)?.[0] ?? "";
    expect(svg).toContain('role="img"');
    expect(svg).toContain("ETFs 59.2%");
    expect(svg).toContain("Stocks 33.0%");
    expect(svg).toContain("Cash 7.8%");
    expect(html.match(/data-slice=/g)).toHaveLength(3);
  });

  it("shows the portfolio total in the middle of the donut", () => {
    const donut = html.match(/<svg[^>]*aria-label="Allocation by asset class:[\s\S]*?<\/svg>/)?.[0] ?? "";
    expect(donut).toContain("$19,182.00");
  });
});

describe("allocation donut with a $0 asset class", () => {
  it("labels and colours each slice by its own class, skipping the empty one", () => {
    const svg = renderToStaticMarkup(
      <AllocationDonut
        total="$10.00"
        slices={[
          { label: "ETFs", value: "$9.00", pct: "90.0%", share: 0.9 },
          { label: "Stocks", value: "$0.00", pct: "0.0%", share: 0 },
          { label: "Cash", value: "$1.00", pct: "10.0%", share: 0.1 },
        ]}
      />
    );
    const paths = [...svg.matchAll(/<path[^>]*data-slice="([^"]+)"[^>]*fill="([^"]+)"/g)].map((m) => [m[1], m[2]]);
    expect(paths).toEqual([
      ["ETFs", SLICE_COLORS.ETFs],
      ["Cash", SLICE_COLORS.Cash],
    ]);
  });
});

describe("benchmark panel", () => {
  it("leads with the plain-language headline", () => {
    expect(text).toContain("You're 5.2 percentage points ahead of VEQT since June.");
  });

  it("has a text alternative line under the chart", () => {
    expect(text).toContain("Portfolio +11.5% vs VEQT +6.3% (+5.2pp)");
  });

  it("renders the line chart as a labelled image with both lines", () => {
    const svg = html.match(/<svg[^>]*role="img"[^>]*aria-label="Line chart[^>]*>/)?.[0] ?? "";
    expect(svg).toMatch(/aria-label="[^"]*VEQT[^"]*"/);
    expect(html.match(/data-series="(portfolio|veqt)"/g)).toHaveLength(2);
  });

  it("offers the numbers as a table, one row per month", () => {
    const tbody = html.match(/<table[^>]*aria-label="Portfolio vs VEQT by month"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
    expect(tbody.match(/<tr/g)).toHaveLength(6);
  });
});

/** The markup of the <section> whose heading has this id. */
function sectionFor(headingId: string): string {
  const open = html.indexOf(`aria-labelledby="${headingId}"`);
  if (open === -1) return "";
  const start = html.lastIndexOf("<section", open);
  return html.slice(start, html.indexOf("</section>", open) + "</section>".length);
}
const plain = (markup: string) => markup.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("contribution projector", () => {
  const panel = sectionFor("projector-heading");
  const panelText = plain(panel);

  it("is anchored so the surplus line can link to it", () => {
    expect(panel).toContain('id="projector"');
  });

  it("defaults to $200/mo, 7%, 10 years: $34,616.96", () => {
    expect(panelText).toContain("$34,616.96");
    expect(panelText).toMatch(/10 years/);
  });

  it("splits deposits from growth", () => {
    expect(panelText).toContain("$24,000.00");
    expect(panelText).toContain("$10,616.96");
  });

  it("shows the 5-year mark", () => {
    expect(panelText).toContain("$14,318.58");
  });

  it("shows the formula with the numbers plugged in", () => {
    expect(panelText).toContain("FV = P × ((1 + r)ⁿ − 1) ÷ r");
    expect(panelText).toContain("r = 7% ÷ 12 = 0.5833% a month");
    expect(panelText).toContain("n = 10 years × 12 = 120 months");
  });

  it("has a labelled number field and slider for each input", () => {
    for (const [id, name] of [["projector-monthly", "Monthly contribution"], ["projector-rate", "Annual return"], ["projector-years", "Years"]]) {
      expect(panel).toMatch(new RegExp(`<label[^>]*for="${id}"[^>]*>${name}`));
      expect(panel).toMatch(new RegExp(`<input[^>]*id="${id}"[^>]*type="number"|<input[^>]*type="number"[^>]*id="${id}"`));
      expect(panel).toMatch(new RegExp(`<input[^>]*type="range"[^>]*aria-label="${name}[^"]*"`));
    }
  });

  it("says the return is an assumption", () => {
    expect(panelText).toMatch(/assumed return, not a prediction/i);
  });

  it("carries the investable-surplus line", () => {
    expect(panelText).toContain("You had $588.48 left in October");
  });
});

describe("coach panel on the dashboard", () => {
  it("sits after the projector", () => {
    const coach = html.indexOf('aria-labelledby="coach-heading"');
    expect(coach).toBeGreaterThan(html.indexOf('aria-labelledby="projector-heading"'));
  });
});

describe("diversification check", () => {
  const panelText = plain(sectionFor("checks-heading"));

  it("lists each check with the actual figure", () => {
    expect(panelText).toContain("Largest: MSFT at 12.5%");
    expect(panelText).toContain("Largest: MSFT at 37.9%");
    expect(panelText).toContain("Cash is 7.8% of your portfolio");
  });

  it("explains that ETFs are exempt", () => {
    expect(panelText).toMatch(/ETFs aren't counted/);
  });
});

describe("accounts", () => {
  const panelText = plain(sectionFor("accounts-heading"));

  it("one line per account with its value and plain-language meaning", () => {
    expect(panelText).toMatch(/TFSA Tax-Free Savings Account \$10,922\.00/);
    expect(panelText).toMatch(/RRSP Registered Retirement Savings Plan \$2,280\.00/);
    expect(panelText).toMatch(/non-registered Non-registered account \$5,980\.00/);
    expect(panelText).toContain("aren't taxed");
  });

  it("says the tags are not tax advice", () => {
    expect(panelText).toMatch(/informational, not tax advice/i);
  });
});

describe("empty portfolio", () => {
  const empty = renderToStaticMarkup(<Dashboard view={buildDashboard([], benchmark)} />);

  it("says there are no holdings and offers to load the mock portfolio", () => {
    expect(empty).toContain("No holdings yet");
    expect(empty).toMatch(/<a[^>]*href="\/"[^>]*>Load the mock portfolio<\/a>/);
  });

  it("still shows the mock-data badge and never renders NaN", () => {
    expect(empty).toContain("Mock data — as of Nov 25, 2026");
    expect(empty).not.toContain("NaN");
  });

  it("draws no donut and no hero", () => {
    expect(empty).not.toContain("data-slice=");
    expect(empty).not.toContain('aria-label="Portfolio value"');
  });
});
