import type { ReactNode } from "react";

export function Card({
  title,
  note,
  children,
  id,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  id: string;
}) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-stone bg-paper p-6">
      <h2 id={id} className="font-display text-[22px] font-semibold leading-snug">
        {title}
      </h2>
      {note && <p className="mt-1 text-[13px] text-pebble">{note}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** A dash for figures that don't apply (e.g. per-share price of cash). */
export function NotApplicable() {
  return (
    <>
      <span aria-hidden="true" className="text-pebble">—</span>
      <span className="sr-only">Not applicable</span>
    </>
  );
}
