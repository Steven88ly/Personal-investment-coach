import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "../app/page";

async function render(searchParams: Record<string, string> = {}) {
  return renderToStaticMarkup(await HomePage({ searchParams: Promise.resolve(searchParams) }));
}

describe("home page", () => {
  it("renders the FinCoach heading", async () => {
    expect(await render()).toMatch(/<h1[^>]*>FinCoach<\/h1>/);
  });

  it("renders the seeded portfolio by default", async () => {
    expect(await render()).toContain("$19,182.00");
  });

  it("shows the empty state for ?portfolio=empty", async () => {
    const html = await render({ portfolio: "empty" });
    expect(html).toContain("No holdings yet");
    expect(html).not.toContain("$19,182.00");
  });
});
