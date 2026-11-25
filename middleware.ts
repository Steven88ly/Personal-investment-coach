import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, authConfig, verifySession } from "./lib/auth";

/**
 * Auth on every route. Signed-out page visits go to /login (remembering the
 * path); signed-out API calls get 401. Fails closed: if auth isn't configured
 * safely (lib/auth.ts authConfig), nobody gets in.
 */

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const cfg = authConfig(process.env);
  const user = cfg.ok ? await verifySession(req.cookies.get(SESSION_COOKIE)?.value, cfg.secret) : null;
  if (user) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const login = new URL("/login", req.url);
  login.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except Next's static assets and the bundled fonts.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
