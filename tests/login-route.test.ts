import { beforeEach, describe, expect, it } from "vitest";
import { POST as login } from "../app/api/login/route";
import { POST as logout } from "../app/api/logout/route";
import { SESSION_COOKIE, verifySession } from "../lib/auth";

const SECRET = "s".repeat(40);

beforeEach(() => {
  process.env.DEMO_USER = "demo";
  process.env.DEMO_PASS = "a-real-passphrase";
  process.env.SESSION_SECRET = SECRET;
});

let ip = 0;
function form(fields: Record<string, string>, from = `10.1.0.${++ip}`) {
  return new Request("https://fincoach.test/api/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": from },
    body: new URLSearchParams(fields).toString(),
  });
}

describe("POST /api/login", () => {
  it("right credentials → HttpOnly, Secure, SameSite session cookie and a redirect to next", async () => {
    const res = await login(form({ username: "demo", password: "a-real-passphrase", next: "/?portfolio=empty" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://fincoach.test/?portfolio=empty");
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toMatch(new RegExp(`^${SESSION_COOKIE}=`));
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/Secure/i);
    expect(cookie).toMatch(/SameSite=lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=28800/);
    const token = cookie.split(";")[0].split("=")[1];
    expect(await verifySession(token, SECRET)).toBe("demo");
  });

  it("wrong credentials → back to /login with an error, no cookie", async () => {
    const res = await login(form({ username: "demo", password: "nope-nope-nope", next: "/" }));
    expect(res.headers.get("location")).toBe("https://fincoach.test/login?error=invalid&next=%2F");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("never redirects off-site", async () => {
    const res = await login(form({ username: "demo", password: "a-real-passphrase", next: "https://evil.example" }));
    expect(res.headers.get("location")).toBe("https://fincoach.test/");
  });

  it("allows 5 attempts a minute per client, then refuses", async () => {
    const from = "10.9.9.9";
    for (let i = 0; i < 5; i++) await login(form({ username: "demo", password: "guess-guess-guess" }, from));
    const res = await login(form({ username: "demo", password: "a-real-passphrase" }, from));
    expect(res.headers.get("location")).toContain("error=rate");
    expect(res.headers.get("set-cookie")).toBeNull();
  });

  it("unconfigured auth refuses sign-in without saying why to the visitor", async () => {
    process.env.DEMO_PASS = "change-me-before-deploy";
    const res = await login(form({ username: "demo", password: "change-me-before-deploy" }));
    expect(res.headers.get("location")).toContain("error=unavailable");
    expect(res.headers.get("set-cookie")).toBeNull();
  });
});

describe("POST /api/logout", () => {
  it("clears the session cookie and goes to /login", async () => {
    const res = await logout(new Request("https://fincoach.test/api/logout", { method: "POST" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://fincoach.test/login");
    expect(res.headers.get("set-cookie")).toMatch(new RegExp(`^${SESSION_COOKIE}=;.*Max-Age=0`, "i"));
  });
});
