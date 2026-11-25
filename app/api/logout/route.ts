import { SESSION_COOKIE } from "../../../lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request): Promise<Response> {
  return new Response(null, {
    status: 303,
    headers: {
      Location: new URL("/login", req.url).toString(),
      "Set-Cookie": `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`,
      "Cache-Control": "no-store",
    },
  });
}
