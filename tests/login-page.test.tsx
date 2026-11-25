import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LoginPage from "../app/login/page";
import { Header } from "../app/components/Header";
import nextConfig from "../next.config";

const render = async (params: Record<string, string> = {}) =>
  renderToStaticMarkup(await LoginPage({ searchParams: Promise.resolve(params) })).replace(/&#x27;/g, "'");

describe("sign-in page", () => {
  it("posts username and password to /api/login with labelled, autocomplete-friendly fields", async () => {
    const html = await render();
    expect(html).toMatch(/<form[^>]*action="\/api\/login"[^>]*method="post"|<form[^>]*method="post"[^>]*action="\/api\/login"/);
    expect(html).toMatch(/<label[^>]*for="username"/);
    expect(html).toMatch(/<input[^>]*autoComplete="username"/);
    expect(html).toMatch(/<label[^>]*for="password"/);
    expect(html).toMatch(/<input[^>]*type="password"[^>]*autoComplete="current-password"|<input[^>]*autoComplete="current-password"[^>]*type="password"/);
  });

  it("carries a safe next path through the form", async () => {
    expect(await render({ next: "/?portfolio=empty" })).toContain('value="/?portfolio=empty"');
    expect(await render({ next: "https://evil.example" })).toMatch(/name="next"[^>]*value="\/"|value="\/"[^>]*name="next"/);
  });

  it.each([
    ["invalid", "That username and password don't match."],
    ["rate", "Too many attempts. Wait a minute and try again."],
    ["unavailable", "Sign-in is unavailable right now."],
  ])("explains error=%s", async (code, message) => {
    expect(await render({ error: code })).toContain(message);
  });

  it("ignores unknown error codes", async () => {
    expect(await render({ error: "<script>" })).not.toContain("script");
  });
});

describe("header sign-out", () => {
  it("has a Sign out button that posts to /api/logout", () => {
    const html = renderToStaticMarkup(<Header asOf="Nov 25, 2026" />);
    expect(html).toMatch(/<form[^>]*action="\/api\/logout"[^>]*method="post"|<form[^>]*method="post"[^>]*action="\/api\/logout"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Sign out<\/button>/);
  });
});

describe("security headers", () => {
  it("applies CSP, framing, sniffing, referrer and permissions headers to every path", async () => {
    const rules = await nextConfig.headers!();
    const all = rules.find((r) => r.source === "/:path*")!;
    const h = Object.fromEntries(all.headers.map((x) => [x.key, x.value]));
    expect(h["Content-Security-Policy"]).toContain("default-src 'self'");
    expect(h["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
    expect(h["Content-Security-Policy"]).toContain("connect-src 'self'");
    expect(h["Content-Security-Policy"]).toContain("form-action 'self'");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Permissions-Policy"]).toContain("camera=()");
  });
});
