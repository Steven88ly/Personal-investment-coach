/** Loading state (DESIGN.md): skeleton rows in the holdings table. */
export default function Loading() {
  return (
    <main aria-busy="true" className="mx-auto flex max-w-[1024px] flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <span className="sr-only">Loading your portfolio</span>
      <div className="h-7 w-32 rounded-md bg-stone" />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-md bg-stone/60" />
        ))}
      </div>
      <div className="rounded-xl border border-stone bg-paper p-6">
        <div className="h-6 w-28 rounded-md bg-stone" />
        <div className="mt-5 flex flex-col gap-3">
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="h-10 rounded-md bg-linen" />
          ))}
        </div>
      </div>
    </main>
  );
}
