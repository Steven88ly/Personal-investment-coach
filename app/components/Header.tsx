export function Header({ asOf }: { asOf: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-none tracking-[-0.01em]">FinCoach</h1>
        <p className="mt-2 max-w-[72ch] text-[13px] text-pebble">
          An educational tool, not financial advice. Every figure here is illustrative mock data.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="rounded-full border border-stone bg-paper px-3 py-1 text-[13px] font-medium">
          Mock data — as of {asOf}
        </p>
        <form action="/api/logout" method="post">
          <button
            type="submit"
            className="rounded-full border border-ink/70 px-3 py-1 text-[13px] transition-colors duration-150 hover:bg-stone/60"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
