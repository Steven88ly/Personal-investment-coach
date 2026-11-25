import { safeNextPath } from "../../lib/auth";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  invalid: "That username and password don't match.",
  rate: "Too many attempts. Wait a minute and try again.",
  unavailable: "Sign-in is unavailable right now.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; error?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = safeNextPath(typeof params.next === "string" ? params.next : "/");
  const error = typeof params.error === "string" ? ERRORS[params.error] : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-[420px] flex-col justify-center px-4 py-12">
      <h1 className="font-display text-[28px] font-semibold leading-none">FinCoach</h1>
      <p className="mt-2 text-[14px] text-pebble">Sign in with the demo account. Every figure inside is mock data.</p>

      <form action="/api/login" method="post" className="mt-8 flex flex-col gap-4 rounded-xl border border-stone bg-paper p-6">
        {error && (
          <p role="alert" className="text-[14px]">
            {error}
          </p>
        )}
        <input type="hidden" name="next" value={next} />
        <div>
          <label htmlFor="username" className="text-[14px] font-medium">
            Username
          </label>
          <input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            required
            maxLength={64}
            className="mt-1 w-full rounded-lg border border-stone bg-linen px-3 py-2 text-[15px] outline-none focus:border-ink"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-[14px] font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            className="mt-1 w-full rounded-lg border border-stone bg-linen px-3 py-2 text-[15px] outline-none focus:border-ink"
          />
        </div>
        <button
          type="submit"
          className="mt-2 rounded-full bg-charcoal px-5 py-2.5 text-[14px] font-medium text-paper transition-opacity duration-150 hover:opacity-85"
        >
          Sign in
        </button>
      </form>
    </main>
  );
}
