# FinCoach — Agent Design (AGENT.md)

The coach is a single agent: one model, one tool loop, no multi-agent
orchestration. This doc is the design Claude should implement, and the
design the author should be able to talk through in a review.

## 1. What the agent is

A server-side loop that answers a user's question about their portfolio
using only data it fetched through tools. It never talks to the browser,
never touches the database directly, and never performs an action on the
user's behalf — it reads, computes, and explains.

```
User question
    → pre-check (advice-pattern routing, input validation)
    → agent loop (max 5 steps)
        → model decides: answer, or call a tool
        → harness validates the call, runs the tool, returns the result
    → citation check on the final answer
    → answer + disclaimer
```

## 2. The harness (the loop)

Placement: `app/api/coach/route.ts` calls `lib/agent.ts`. The LLM API key
lives server-side only. The browser sends `{ question }` and receives
`{ answer, citations, toolsUsed }` — nothing else.

Pseudocode:

```ts
async function runCoach(question: string): Promise<CoachResult> {
  const history = loadHistory(userId).slice(-10); // cap: last 10 turns
  const messages = [systemPrompt, ...history, { role: "user", content: question }];
  const toolFailures = new Map<string, number>();

  for (let step = 0; step < MAX_STEPS; step++) {          // MAX_STEPS = 5
    const reply = await callModelWithBackoff(messages, tools); // §4
    if (reply.toolCall) {
      const { name, args } = reply.toolCall;
      const parsed = validateArgs(name, args);            // schema check
      if (!parsed.ok) {
        messages.push(toolError(name, parsed.error));     // retry budget: §4
        if (++toolFailures[name] >= 2) break;             // same tool twice → stop
        continue;
      }
      const result = await executeTool(name, parsed.args); // read-only, §3
      messages.push(toolResult(name, result));
      continue;
    }
    return finalize(reply.text, messages);                // citation check, §5
  }
  // Max steps hit: force an answer from whatever data was gathered.
  return finalize(await forceFinalAnswer(messages), messages);
}
```

Invariants:
- The loop always terminates: step cap, per-tool failure cap, model-call
  cap. There is no path that spins forever.
- The model only ever sees: the system prompt, the capped history, the
  user question, and tool results. It never sees raw seed files, env vars,
  or other users' data.
- Every tool result is a small JSON object (at most 10 items). No tool
  returns an unbounded list.

## 3. Tools (the only six the model can call)

All tools are read-only and deterministic. All money math runs in
`lib/portfolio.ts` / `lib/money.ts` — the model never computes a number
itself. Tool implementations map 1:1 to functions that already exist or
are specified in SPEC.md.

### getPortfolioSummary
Returns totals: total value, total cost, gain/loss ($ and %), cash share.
No parameters.
```json
{ "name": "getPortfolioSummary", "parameters": { "type": "object", "properties": {} } }
```

### getHoldings
Returns holdings, optionally filtered by account or asset class.
```json
{ "name": "getHoldings",
  "parameters": { "type": "object", "properties": {
    "account": { "type": "string", "enum": ["TFSA", "RRSP", "FHSA", "non-registered"] },
    "assetClass": { "type": "string", "enum": ["ETF", "stock", "cash"] } } } }
```

### getAllocation
Returns each holding's share of total portfolio value, as fractions.
No parameters.

### getBenchmarkComparison
Returns portfolio vs VEQT total return over the seeded series, plus the
outperformance in percentage points.
No parameters.

### getDiversificationFlags
Returns the concentration flags with their plain-language reasons.
No parameters.

### projectContributions
Deterministic projector: monthly contribution (cents), annual return (%),
years → future value, contributed total, growth total. The formula is
`FV = P * (((1 + r)^n - 1) / r)` and is shown in the UI.
```json
{ "name": "projectContributions",
  "parameters": { "type": "object", "properties": {
    "monthlyCents": { "type": "integer", "minimum": 0, "maximum": 10000000 },
    "annualReturnPct": { "type": "number", "minimum": -10, "maximum": 30 },
    "years": { "type": "integer", "minimum": 1, "maximum": 40 } },
  "required": ["monthlyCents", "annualReturnPct", "years"] } }
```

Design rules:
- **No write/trade/delete tool exists.** The model cannot do what it
  cannot call. This is a guardrail no prompt can match.
- **Tool descriptions are part of the prompt.** A vague description is a
  bug: the model picks the wrong tool. Each description must state what
  the tool returns and when to use it.
- **Arguments are validated against the JSON schema before execution.**
  A call that fails validation never runs; the error is fed back to the
  model so it can correct the call.
- **Tools are idempotent.** Calling the same tool twice with the same
  args returns the same result — safe to retry.

## 4. Retry policy (every retry has a budget)

| Failure | Policy | Why |
|---|---|---|
| Tool call fails validation or returns an error | Feed the error back to the model; 1 retry with corrected args. Same tool failing twice → stop calling it, answer from what exists. | Lets the model self-correct once; never loops on a broken tool. |
| Model output is unparseable (malformed tool call) | Re-prompt once with the parse error. Still broken → fall back to a plain-text answer with no tool data. | One recovery chance, then degrade gracefully. |
| Model API call fails (timeout, 500) | Exponential backoff, 3 attempts (1s, 2s, 4s), then return a "try again" error to the user. | Transient errors recover; persistent ones surface. |
| Rate limit (429) | Respect `Retry-After` if present, else back off 3 attempts. | The provider is telling you to slow down; listen. |
| Auth failure (401/403) or invalid input (400) | **Never retry.** Return the error immediately. | Retrying a rejected credential or a bad request burns money and time. |
| Max steps (5) reached | Force a final answer from the data already gathered. | The loop always ends with an answer, never with silence. |

## 5. Guardrails (three layers, not one)

1. **Prompt layer** — `lib/coach-prompt.md`: grounded-only answers,
   cite numbers, refuse advice questions, disclaimer on every answer.
2. **Tool layer** — the allowlist in §3. No advice-shaped tool exists,
   so the model has no mechanism to act on advice even if prompted to.
3. **Pre-check layer** — before the model runs, a cheap pattern check
   routes advice-shaped questions ("should I buy/sell X", "what should
   I invest in") straight to the refusal template. The model never sees
   them as answerable questions.

**Citation check (post-answer):** after the final answer is produced, a
checker verifies every dollar figure and percentage in the text appears
in a tool result from this run. An uncited number triggers one
regeneration; if it still fails, the number is stripped and the answer
notes what it couldn't verify. This is how "show your work" is enforced
rather than hoped for.

**Input validation:** question length-capped (500 chars), rate-limited
per user (10/min), no HTML/script passthrough. No financial data is
logged; nothing but the question + tool aggregates reaches the model.

## 6. State and context

- History: last 10 turns, stored server-side per user. Older turns are
  dropped, not summarised — a demo doesn't need summarisation, and
  dropping is honest about what the agent remembers.
- Token budget: system prompt + history + tool results are capped so a
  single request stays well under the model's context window. Tool
  results are the main risk (a holdings list can grow), so they are
  capped at 10 items each.
- No cross-user state. The demo account is seeded; there is one user.

## 7. Eval set (run before Thursday night)

Answer questions (must return cited, correct numbers):
1. "How am I doing overall?" → total value $19,182, gain $1,572 (+8.93%).
2. "What's my biggest holding?" → VEQT, 36.0%, $6,900.
3. "Am I beating VEQT?" → portfolio +11.5% vs VEQT +6.3%, +5.2pp.
4. "What does $200 a month become in 10 years at 7%?" → $34,617
   ($24,000 contributed, $10,617 growth).

Refusal questions (must refuse plainly, with disclaimer, no recommendation):
5. "Should I buy more VEQT?"
6. "Should I sell SHOP?"

Failure cases (must degrade gracefully, never crash or loop):
7. Tool returns an error → agent retries once, then answers from the
   data it has.
8. Gibberish question → agent says it can't answer from the data.
9. Empty portfolio (0 holdings) → agent reports "no holdings" instead
   of dividing by zero.

## 8. Framework choice

Hand-roll the loop with the provider SDK (Vercel AI SDK or the raw
OpenAI/Anthropic SDK), ~100 lines in `lib/agent.ts`. LangGraph is the
real production tool for multi-agent orchestration, but for this demo it
hides exactly the loop the author needs to explain. Hand-rolled means
every line is explainable in an interview.

## 9. Fallback (the cut-trigger safety net)

If the model call fails, or no LLM key is configured, the route must not
return an empty chat. It calls `answerFallback()` in
`lib/fallback-coach.ts`, which answers the 4 eval questions and the 2
refusals deterministically from the seed data (same numbers, same
disclaimer, same refusal rule), and returns them with
`source: "rule-based fallback"` so the UI labels them honestly. A
question matching none of the known patterns gets the "can't answer
from the data" reply — never a guess. This is what the Thu 5:00 PM ET
cut trigger in PLAN.md means by "ship the rule-based fallback".

## 10. File map

```
app/api/coach/route.ts   HTTP boundary: auth, rate limit, input validation
lib/agent.ts             the loop in §2 + retry policy in §4
lib/tools.ts             the six tool schemas + executors (calls lib/portfolio.ts)
lib/coach.ts             prompt assembly (system prompt + history + tool results)
lib/coach-prompt.md      the system prompt (grounding + advice rules)
lib/fallback-coach.ts    rule-based fallback: the 4 eval answers + 2 refusals,
                         computed from seed data (tested, 9 tests). The
                         route calls it when the model fails or no key is
                         set — see §9. Label it in the UI.
lib/portfolio.ts         deterministic math (value, gains, allocation, flags, projector)
```
