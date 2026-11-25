/**
 * Demo auth: one seeded account (DEMO_USER / DEMO_PASS), an HMAC-signed
 * session cookie, and fail-closed config. Web Crypto only, so the same code
 * runs in middleware (Edge) and in route handlers (Node).
 *
 * Token: `${user}.${expiresAtSeconds}.${base64url(HMAC-SHA256(secret, user.exp))}`
 */

export const SESSION_COOKIE = "fincoach_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
const TEMPLATE_PASSWORD = "change-me-before-deploy";
const USER_RE = /^[A-Za-z0-9_-]{1,64}$/;

export interface AuthEnv {
  [key: string]: string | undefined;
  DEMO_USER?: string;
  DEMO_PASS?: string;
  SESSION_SECRET?: string;
}

export type AuthConfig = { ok: true; user: string; pass: string; secret: string } | { ok: false };

/** Refuses to run with a missing, weak, or template password, or a weak secret. */
export function authConfig(env: AuthEnv): AuthConfig {
  const { DEMO_USER: user, DEMO_PASS: pass, SESSION_SECRET: secret } = env;
  if (!user || !USER_RE.test(user)) return { ok: false };
  if (!pass || pass === TEMPLATE_PASSWORD || pass.length < 12) return { ok: false };
  if (!secret || secret.length < 32) return { ok: false };
  return { ok: true, user, pass, secret };
}

const enc = new TextEncoder();

async function sha256(text: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}

/** Compares fixed-length digests without short-circuiting. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

export async function checkCredentials(user: string, pass: string, env: AuthEnv): Promise<boolean> {
  const cfg = authConfig(env);
  if (!cfg.ok) return false;
  const [u1, u2, p1, p2] = await Promise.all([sha256(user), sha256(cfg.user), sha256(pass), sha256(cfg.pass)]);
  const userOk = sameBytes(u1, u2);
  const passOk = sameBytes(p1, p2);
  return userOk && passOk;
}

const hmacKey = (secret: string) =>
  crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);

const toB64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export async function signSession(user: string, secret: string, nowMs = Date.now()): Promise<string> {
  const exp = Math.floor(nowMs / 1000) + SESSION_TTL_SECONDS;
  const payload = `${user}.${exp}`;
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload)));
  return `${payload}.${toB64url(sig)}`;
}

/** The session's user, or null if the token is missing, forged, or expired. */
export async function verifySession(token: string | undefined, secret: string, nowMs = Date.now()): Promise<string | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [user, expText, sigText] = parts;
  if (!USER_RE.test(user) || !/^\d{1,12}$/.test(expText)) return null;
  const sig = fromB64url(sigText);
  if (!sig) return null;
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(secret), sig, enc.encode(`${user}.${expText}`));
  if (!valid) return null;
  if (Number(expText) * 1000 < nowMs) return null;
  return user;
}

/** Only same-site relative paths survive; anything else goes home. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f]/.test(next)) return "/";
  return next;
}

/** The session token from a raw Cookie header (route handlers get no parsed cookies). */
export function sessionToken(cookieHeader: string | null): string | undefined {
  for (const part of (cookieHeader ?? "").split(";")) {
    const eq = part.indexOf("=");
    if (eq > 0 && part.slice(0, eq).trim() === SESSION_COOKIE) return part.slice(eq + 1).trim() || undefined;
  }
  return undefined;
}

/** The signed-in user for a request, or null. Fails closed like the middleware. */
export async function requestUser(req: Request): Promise<string | null> {
  const cfg = authConfig(process.env);
  if (!cfg.ok) return null;
  return verifySession(sessionToken(req.headers.get("cookie")), cfg.secret);
}
