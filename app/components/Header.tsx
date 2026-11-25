export function Header({ asOf }: { asOf: string }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div>
        <h1 className="font-display text-[28px] font-semibold leading-none tracking-[-0.01em]">FinCoach</h1>
        <p className="mt-2 max-w-[72ch] text-[13px] text-pebble">
          An educational tool, not financial advice. Every figure here is illustrative mock data.
        </p>
      </div>
      <p className="rounded-full border border-stone bg-paper px-3 py-1 text-[13px] font-medium">
        Mock data — as of {asOf}
      </p>
    </header>
  );
}
