import { SESSION_COOKIE, SESSION_TTL_SECONDS, authConfig, checkCredentials, safeNextPath, signSession } from "../../../lib/auth";
import { clientIp, createRateLimiter } from "../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 5 sign-in attempts a minute per client: slows password guessing. */
const attempts = createRateLimiter({ limit: 5, windowMs: 60_000 });

const redirect = (req: Request, path: string, cookie?: string) => {
  const headers = new Headers({ Location: new URL(path, req.url).toString(), "Cache-Control": "no-store" });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
};

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData().catch(() => null);
  const next = safeNextPath(String(form?.get("next") ?? "/"));
  const back = (error: string) => redirect(req, `/login?error=${error}&next=${encodeURIComponent(next)}`);

  if (!attempts.allow(clientIp(req))) return back("rate");

  const cfg = authConfig(process.env);
  if (!cfg.ok) {
    // Tell the operator (no values), not the visitor.
    console.warn("auth: sign-in refused, DEMO_USER / DEMO_PASS / SESSION_SECRET not configured safely");
    return back("unavailable");
  }

  const user = String(form?.get("username") ?? "");
  const pass = String(form?.get("password") ?? "");
  if (!(await checkCredentials(user, pass, process.env))) return back("invalid");

  const token = await signSession(cfg.user, cfg.secret);
  const cookie = `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
  return redirect(req, next, cookie);
}
