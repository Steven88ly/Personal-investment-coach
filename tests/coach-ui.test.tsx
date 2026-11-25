import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CoachAnswer } from "../app/components/CoachAnswer";
import { CoachPanel, SUGGESTED_QUESTIONS } from "../app/components/CoachPanel";
import { COACH_DISCLAIMER } from "../lib/agent";

const plain = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ");

describe("coach panel", () => {
  const html = renderToStaticMarkup(<CoachPanel />);

  it("offers the 4 eval questions and 1 refusal as suggestion chips", () => {
    expect(SUGGESTED_QUESTIONS).toEqual([
      "How am I doing overall?",
      "What's my biggest holding?",
      "Am I beating VEQT?",
      "What does $200 a month become in 10 years at 7%?",
      "Should I buy more VEQT?",
    ]);
    for (const q of SUGGESTED_QUESTIONS) expect(plain(html)).toContain(q);
  });

  it("has a labelled input capped at 500 characters and an Ask button", () => {
    expect(html).toMatch(/<label[^>]*for="coach-question"/);
    expect(html).toMatch(/<(input|textarea)[^>]*id="coach-question"[^>]*maxLength="500"|<(input|textarea)[^>]*maxLength="500"[^>]*id="coach-question"/);
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Ask<\/button>/);
  });

  it("says what the coach can and can't do", () => {
    expect(plain(html)).toMatch(/never tells you what to buy or sell/i);
  });
});

describe("a coach answer", () => {
  const base = {
    question: "How am I doing overall?",
    answer: `Your portfolio is worth $19,182.00.\n\n${COACH_DISCLAIMER}`,
    citations: ["Portfolio summary: total value $19,182.00"],
    toolsUsed: ["getPortfolioSummary"],
    isRefusal: false,
  };

  it("shows the answer, a Sources list, and the disclaimer under it", () => {
    const text = plain(renderToStaticMarkup(<CoachAnswer {...base} source="live" />));
    expect(text).toContain("Your portfolio is worth $19,182.00.");
    expect(text).toMatch(/Sources Portfolio summary: total value \$19,182\.00/);
    expect(text).toContain(COACH_DISCLAIMER);
    expect(text).not.toMatch(/Rule-based answer/);
  });

  it("labels fallback answers honestly", () => {
    const text = plain(renderToStaticMarkup(<CoachAnswer {...base} source="rule-based fallback" />));
    expect(text).toContain("Rule-based answer — live coach unavailable");
  });

  it("renders a refusal like any other answer, with no alarm styling", () => {
    const html = renderToStaticMarkup(
      <CoachAnswer {...base} answer={`I can't recommend that.\n\n${COACH_DISCLAIMER}`} citations={[]} source="pre-check" isRefusal />
    );
    expect(plain(html)).toContain("I can't recommend that.");
    expect(html).not.toMatch(/text-loss|bg-loss|border-loss/);
  });
});
