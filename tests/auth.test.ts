import { describe, expect, it } from "vitest";
import {
  SESSION_TTL_SECONDS,
  authConfig,
  checkCredentials,
  safeNextPath,
  sessionToken,
  signSession,
  verifySession,
} from "../lib/auth";

const SECRET = "x".repeat(32);
const GOOD = { DEMO_USER: "demo", DEMO_PASS: "a-real-passphrase", SESSION_SECRET: SECRET };

describe("authConfig: fails closed", () => {
  it("is ready with a user, a real password, and a 32+ char session secret", () => {
    expect(authConfig(GOOD)).toEqual({ ok: true, user: "demo", pass: "a-real-passphrase", secret: SECRET });
  });

  it.each([
    ["no password", { ...GOOD, DEMO_PASS: undefined }],
    ["the template default password", { ...GOOD, DEMO_PASS: "change-me-before-deploy" }],
    ["a password under 12 characters", { ...GOOD, DEMO_PASS: "short" }],
    ["no user", { ...GOOD, DEMO_USER: "" }],
    ["no session secret", { ...GOOD, SESSION_SECRET: undefined }],
    ["a short session secret", { ...GOOD, SESSION_SECRET: "too-short" }],
  ])("refuses with %s", (_, env) => {
    expect(authConfig(env).ok).toBe(false);
  });
});

describe("checkCredentials", () => {
  it("accepts the right pair only", async () => {
    expect(await checkCredentials("demo", "a-real-passphrase", GOOD)).toBe(true);
    expect(await checkCredentials("demo", "wrong-passphrase!", GOOD)).toBe(false);
    expect(await checkCredentials("admin", "a-real-passphrase", GOOD)).toBe(false);
    expect(await checkCredentials("demo", "", GOOD)).toBe(false);
  });

  it("refuses everything when auth isn't configured safely", async () => {
    const env = { ...GOOD, DEMO_PASS: "change-me-before-deploy" };
    expect(await checkCredentials("demo", "change-me-before-deploy", env)).toBe(false);
  });
});

describe("session tokens", () => {
  const now = 1_800_000_000_000;

  it("round-trips the user", async () => {
    const token = await signSession("demo", SECRET, now);
    expect(await verifySession(token, SECRET, now)).toBe("demo");
  });

  it("expires after the TTL", async () => {
    const token = await signSession("demo", SECRET, now);
    expect(await verifySession(token, SECRET, now + SESSION_TTL_SECONDS * 1000 + 1)).toBeNull();
  });

  it("rejects a tampered user, expiry, or signature, and a different secret", async () => {
    const token = await signSession("demo", SECRET, now);
    const [user, exp, sig] = token.split(".");
    expect(await verifySession(`admin.${exp}.${sig}`, SECRET, now)).toBeNull();
    expect(await verifySession(`${user}.${Number(exp) + 9999}.${sig}`, SECRET, now)).toBeNull();
    expect(await verifySession(`${user}.${exp}.${sig.slice(0, -2)}AA`, SECRET, now)).toBeNull();
    expect(await verifySession(token, "y".repeat(32), now)).toBeNull();
  });

  it("rejects garbage without throwing", async () => {
    for (const t of ["", "a.b", "a.b.c.d", "...", undefined]) {
      expect(await verifySession(t, SECRET, now)).toBeNull();
    }
  });
});

describe("sessionToken (Cookie header parsing)", () => {
  it("finds the session cookie alone, first, or among others", () => {
    expect(sessionToken("fincoach_session=abc.1.x")).toBe("abc.1.x");
    expect(sessionToken("theme=dark; fincoach_session=abc.1.x; other=2")).toBe("abc.1.x");
    expect(sessionToken("theme=dark;fincoach_session=abc.1.x")).toBe("abc.1.x");
  });

  it("ignores lookalike cookie names and missing headers", () => {
    expect(sessionToken("x_fincoach_session=evil")).toBeUndefined();
    expect(sessionToken(null)).toBeUndefined();
  });
});

describe("safeNextPath (no open redirect)", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/")).toBe("/");
    expect(safeNextPath("/?portfolio=empty")).toBe("/?portfolio=empty");
  });

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "", null])(
    "sends %s home instead",
    (p) => {
      expect(safeNextPath(p)).toBe("/");
    }
  );
});
