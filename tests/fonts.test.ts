import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Builds must not download fonts: a bad Google Fonts response once broke a
 * production build. Fonts ship in the repo and load via next/font/local.
 */
describe("self-hosted fonts", () => {
  const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");

  it("the layout does not fetch fonts from Google at build time", () => {
    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain("next/font/local");
  });

  it("the font files and their licence are in the repo", () => {
    for (const f of ["inter-latin-wght-normal.woff2", "newsreader-latin-wght-normal.woff2", "OFL-Inter.txt", "OFL-Newsreader.txt"]) {
      expect(existsSync(new URL(`../app/fonts/${f}`, import.meta.url)), f).toBe(true);
    }
  });
});
