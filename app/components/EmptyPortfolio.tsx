export function EmptyPortfolio() {
  return (
    <section aria-labelledby="empty-heading" className="rounded-xl border border-stone bg-paper p-6 sm:p-10">
      <h2 id="empty-heading" className="font-display text-[24px] font-semibold">No holdings yet</h2>
      <p className="mt-2 max-w-[56ch] text-[15px] text-pebble">
        Load the mock portfolio to see totals, allocation, and how it compares with VEQT.
      </p>
      <a
        href="/"
        className="mt-6 inline-flex rounded-full bg-charcoal px-5 py-2.5 text-[14px] font-medium text-paper transition-opacity duration-150 hover:opacity-85"
      >
        Load the mock portfolio
      </a>
    </section>
  );
}
