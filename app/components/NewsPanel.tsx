import type { Digest, StoryView } from "../../lib/news";

/**
 * Neutral news digest: what happened, who reported it and when, and how much
 * of the portfolio it touches. No sentiment, impact, or suggestions.
 */

function SampleTag() {
  return <span className="rounded-full border border-stone px-2 py-px text-[11px] font-medium text-pebble">Sample</span>;
}

const TONE_CLASS: Record<NonNullable<StoryView["sentiment"]>["tone"], string> = {
  bearish: "border-loss/40 text-loss",
  neutral: "border-stone text-pebble",
  bullish: "border-gain/40 text-gain",
};

/** Attributed rating: the label word always shows, colour only reinforces it. */
function SentimentTag({ sentiment }: { sentiment: NonNullable<StoryView["sentiment"]> }) {
  return (
    <span
      data-sentiment={sentiment.tone}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-px text-[11px] font-medium ${TONE_CLASS[sentiment.tone]}`}
    >
      <span>{sentiment.label}</span> <span className="font-normal opacity-80">{sentiment.source}</span>
    </span>
  );
}

function Story({ story }: { story: StoryView }) {
  return (
    <article className="flex flex-col gap-1.5">
      <h4 className="text-[15px] font-semibold leading-snug">{story.title}</h4>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-pebble">
        <span>{story.source}</span>
        <span>{story.date}</span>
        {story.sample && <SampleTag />}
        {story.sentiment && <SentimentTag sentiment={story.sentiment} />}
      </p>
      {story.touches && <p className="text-[14px] font-medium tabular-nums">{story.touches}</p>}
      <ul className="flex list-disc flex-col gap-1 pl-5 text-[14px] leading-relaxed marker:text-stone">
        {story.keyPoints.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
      {story.upcoming && (
        <p className="flex flex-wrap items-center gap-x-2 text-[13px] tabular-nums">
          <span className="text-pebble">Coming up</span>
          <span className="font-medium">{story.upcoming.date}</span>
          <span>{story.upcoming.label}</span>
          {story.upcoming.sample && <SampleTag />}
        </p>
      )}
    </article>
  );
}

export function NewsPanel({ digest }: { digest: Digest }) {
  return (
    <section aria-labelledby="news-heading" className="rounded-xl border border-stone bg-paper p-6">
      <h2 id="news-heading" className="font-display text-[22px] font-semibold leading-snug">
        This week for your portfolio
      </h2>
      <p className="mt-1 text-[13px] text-pebble">
        News as of {digest.asOf}. Sample stories are illustrative, not real news.
      </p>

      {digest.market.length > 0 && (
        <div className="mt-5">
          <h3 className="text-[13px] font-medium text-pebble">Market</h3>
          <div className="mt-2 flex flex-col gap-5">
            {digest.market.map((s) => (
              <Story key={s.id} story={s} />
            ))}
          </div>
        </div>
      )}

      {digest.cards.length > 0 && (
        <div className="mt-6">
          <h3 className="text-[13px] font-medium text-pebble">Your holdings</h3>
          <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2">
            {digest.cards.map((c) => (
              <div key={c.ticker} className="flex flex-col gap-3 rounded-xl border border-stone p-4">
                <div>
                  <p className="text-[15px]">
                    <span className="font-semibold">{c.ticker}</span> <span className="text-pebble">{c.name}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] tabular-nums text-pebble">{c.exposure}</p>
                </div>
                {c.stories.map((s) => (
                  <Story key={s.id} story={s} />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {digest.quiet && <p className="mt-5 text-[13px] text-pebble">{digest.quiet}</p>}
    </section>
  );
}
