# FinCoach — Claude Code skills to install

Install these three before building. They are the whole methodology:
workflow, security, and design. Each is from a trusted source — install
skills only from sources you trust, since a skill is instructions Claude
follows (Anthropic's own guidance: untrusted skills are a prompt-injection
risk).

## 1. Overall dev workflow — Superpowers (obra/superpowers)

A 15-skill methodology: brainstorming, writing-plans,
subagent-driven-development, test-driven-development, systematic-debugging,
requesting-code-review, finishing-a-development-branch.

Install (in Claude Code):

```
/plugin install superpowers@claude-plugins-official
```

Why this one: its TDD skill is an iron law — "no production code without
a failing test first," and it deletes code written before tests. That is
exactly the discipline behind FinCoach's "tested money math" claim, and
the code-review skill gives you a self-review pass before Thursday night.

Thursday note: use the brainstorming, planning, and TDD skills. Skip the
git-worktrees ceremony — it's built for teams and long projects, and it
will eat your Thursday. One solo dev, one branch, tests first.

## 2. Security + infra — OWASP Secure Agent Playbook, code-security-skills

OWASP's own skill set (18 skills total). The code-security set covers:

- `code-review-security` — review mapped to OWASP Top 10 + ASVS
- `sca-audit` — dependency CVE scanning with reachability analysis
- `secrets-scan` — hardcoded credentials and API keys
- `api-security-review` — API review against the OWASP API Top 10

Install (in Claude Code):

```
/plugin marketplace add OWASP/secure-agent-playbook
/plugin install code-security-skills@agent-security-playbook
```

Why this one: FinCoach's whole security story is server-side keys, an
authenticated coach endpoint, and no financial data in logs. Run
`secrets-scan` before every commit and `api-security-review` on the coach
route before the demo. Also install the AI set — the coach is an LLM
endpoint, so prompt-injection testing applies to it:

```
/plugin install ai-security-skills@agent-security-playbook
```

## 3. Frontend design — Anthropic's frontend-design

Anthropic's official skill for distinctive, production-grade interfaces.
It forces a design point of view before any code — who the product is
for, what the page's one job is, what should be memorable — and it names
the generic AI looks to avoid (cream page + terracotta accent, black page
+ acid-green highlight, grids of identical rounded cards).

Install (in Claude Code):

```
/plugin install frontend-design@claude-plugins-official
```

Or via the skills CLI:

```
npx skills add https://github.com/anthropics/claude-code --skill frontend-design
```

Why this one: the brief explicitly included "good design principles,"
and the dashboard is what a reviewer judges in the first five seconds. Use this
skill when you ask Claude to build the dashboard, the benchmark chart,
and the projector — not a generic SaaS template. Optional pre-ship audit:
Vercel's `web-design-guidelines` skill, run once on the finished UI.

## How skills trigger

Skills load when your request matches their description — you don't have
to invoke most of them. To force one, name it: "use test-driven-development
for the projector math" or "run secrets-scan before I commit." Skills live
in `~/.claude/skills/` (every project) or `.claude/skills/` (one project).

## Optional: saving tokens — Ponytail yes, Caveman not yet

Two real skills exist for this, and the measured numbers are much smaller
than the advertised ones — judge them on the measurements.

**Ponytail** (DietrichGebert/ponytail) — "the lazy senior dev." It stops
the agent writing unnecessary code: use what's already there, use the
standard library or a native platform feature, then write the minimum.
Advertised −54% code / −20% cost; JetBrains' 80-task paired benchmark
measured −15% code and −10.3% cost, no quality difference. Savings
concentrate on big builds (−31% on 300+ line tasks) and are near zero on
tasks that were already minimal.

Install as a **plugin** — this matters. Installed as a plain SKILL.md it
self-activated zero times in ten test sessions; the plugin's SessionStart
hook force-injects the ruleset into every session, and that's the version
that produces the measured saving:

```
/plugin marketplace add DietrichGebert/ponytail
/plugin install ponytail@ponytail
```

Use full mode (the default). It leaves validation, error handling,
security, and accessibility alone, so it won't fight the OWASP skills.
It can tug against Superpowers' thoroughness — that's fine: ponytail for
how much code gets written, TDD still for whether the math is right.

**Caveman** (JuliusBrussee/caveman) — short, plain replies. Advertised
−65% output tokens; measured ~−8.5% in the same benchmark series, and
the project's own Honest Numbers page says the voice saves ~3% over just
asking for concise answers. Output tokens are the minority of a coding
session's bill anyway — most of the cost is input/context re-sent every
turn. Version 4 adds a local proxy that compresses what the agent *reads*
(measured −33% input tokens), but that's extra infrastructure the night
before a deadline. Skip it for now; revisit if you hit usage limits.

```
# Only if you want the voice later (skill only, no proxy):
npx skills add JuliusBrussee/caveman -g
```

**The bigger lever is free:** one fresh Claude Code session per build
slice, keep SPEC.md/PLAN.md as the source of truth so Claude doesn't
re-derive decisions, and `/compact` when a session gets long. And the
largest token burner in the current setup is Superpowers'
subagent-driven-development (a fresh subagent + two review passes per
task) — worth it for quality, but know that's where the budget goes.
