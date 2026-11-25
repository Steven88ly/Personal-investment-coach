import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { SESSION_COOKIE, signSession } from "../lib/auth";
import { middleware } from "../middleware";

const SECRET = "s".repeat(40);

beforeEach(() => {
  process.env.DEMO_USER = "demo";
  process.env.DEMO_PASS = "a-real-passphrase";
  process.env.SESSION_SECRET = SECRET;
});

const request = (path: string, cookie?: string) =>
  new NextRequest(`https://fincoach.test${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} });

const passedThrough = (res: Response) => res.headers.get("x-middleware-next") === "1";

describe("middleware: auth on every route", () => {
  it("sends a signed-out visitor to /login, remembering where they were going", async () => {
    const res = await middleware(request("/?portfolio=empty"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://fincoach.test/login?next=%2F%3Fportfolio%3Dempty");
  });

  it("answers 401 JSON for a signed-out API call", async () => {
    const res = await middleware(request("/api/coach"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Sign in first." });
  });

  it("lets the sign-in page and sign-in endpoint through", async () => {
    expect(passedThrough(await middleware(request("/login")))).toBe(true);
    expect(passedThrough(await middleware(request("/api/login")))).toBe(true);
  });

  it("lets a valid session through to pages and APIs", async () => {
    const token = await signSession("demo", SECRET);
    expect(passedThrough(await middleware(request("/", token)))).toBe(true);
    expect(passedThrough(await middleware(request("/api/coach", token)))).toBe(true);
  });

  it("rejects a forged or expired session", async () => {
    const forged = await signSession("demo", "f".repeat(40));
    expect((await middleware(request("/", forged))).status).toBe(307);
    const expired = await signSession("demo", SECRET, Date.now() - 9 * 60 * 60 * 1000);
    expect((await middleware(request("/api/coach", expired))).status).toBe(401);
  });

  it("fails closed when auth isn't configured safely", async () => {
    const token = await signSession("demo", SECRET);
    process.env.DEMO_PASS = "change-me-before-deploy";
    expect((await middleware(request("/", token))).status).toBe(307);
  });
});
