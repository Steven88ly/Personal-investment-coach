import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import HomePage from "../app/page";

describe("home page (hello-world scaffold)", () => {
  it("renders the FinCoach heading", () => {
    const html = renderToStaticMarkup(<HomePage />);
    expect(html).toMatch(/<h1[^>]*>FinCoach<\/h1>/);
  });
});
