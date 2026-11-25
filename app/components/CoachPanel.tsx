"use client";

import { useState, type FormEvent } from "react";
import { CoachAnswer, type CoachAnswerProps } from "./CoachAnswer";

/** The 4 eval questions + 1 refusal (DESIGN.md: suggested questions as chips). */
export const SUGGESTED_QUESTIONS = [
  "How am I doing overall?",
  "What's my biggest holding?",
  "Am I beating VEQT?",
  "What does $200 a month become in 10 years at 7%?",
  "Should I buy more VEQT?",
];

type Turn =
  | ({ id: number; state: "answered" } & CoachAnswerProps)
  | { id: number; state: "pending" | "failed"; question: string; error?: string };

export function CoachPanel() {
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const busy = turns.some((t) => t.state === "pending");

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const id = Date.now();
    setInput("");
    setTurns((t) => [...t, { id, state: "pending", question: q }]);
    let next: Turn;
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      next = res.ok
        ? { id, state: "answered", question: q, ...body }
        : { id, state: "failed", question: q, error: body.error ?? "The coach couldn't answer. Try again." };
    } catch {
      next = { id, state: "failed", question: q, error: "The coach couldn't be reached. Check your connection and try again." };
    }
    setTurns((t) => t.map((turn) => (turn.id === id ? next : turn)));
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(input);
  }

  return (
    <section aria-labelledby="coach-heading" className="rounded-xl border border-stone bg-paper p-6">
      <h2 id="coach-heading" className="font-display text-[22px] font-semibold leading-snug">
        Ask the coach
      </h2>
      <p className="mt-1 max-w-[70ch] text-[13px] text-pebble">
        It answers from your holdings and shows the figures it used. It explains; it never tells you what to buy or sell.
      </p>

      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Suggested questions">
        {SUGGESTED_QUESTIONS.map((q) => (
          <li key={q}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void ask(q)}
              className="rounded-full border border-ink/70 px-3 py-1 text-[13px] transition-colors duration-150 hover:bg-stone/60 disabled:opacity-50"
            >
              {q}
            </button>
          </li>
        ))}
      </ul>

      {turns.length > 0 && (
        <ol className="mt-6 flex flex-col gap-6" aria-live="polite">
          {turns.map((t) =>
            t.state === "answered" ? (
              <CoachAnswer key={t.id} {...t} />
            ) : (
              <li key={t.id} className="flex flex-col gap-3">
                <p className="self-end rounded-2xl bg-linen px-4 py-2 text-[15px]">{t.question}</p>
                <p className="rounded-xl border border-stone bg-paper px-4 py-3 text-[15px] text-pebble">
                  {t.state === "pending" ? "Looking at your portfolio…" : t.error}
                </p>
              </li>
            )
          )}
        </ol>
      )}

      <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="coach-question" className="text-[14px] font-medium">
            Your question
          </label>
          <input
            id="coach-question"
            type="text"
            maxLength={500}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            placeholder="How diversified am I?"
            className="mt-1 w-full rounded-lg border border-stone bg-linen px-3 py-2 text-[15px] outline-none focus:border-ink disabled:opacity-60"
          />
        </div>
        <button
          type="submit"
          disabled={busy || input.trim() === ""}
          className="rounded-full bg-charcoal px-5 py-2.5 text-[14px] font-medium text-paper transition-opacity duration-150 hover:opacity-85 disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </section>
  );
}
