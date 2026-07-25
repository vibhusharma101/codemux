---
name: kodemux
description: >-
  Pick the right Claude model, effort level, execution mode, and number of
  parallel agents for a coding task. Use this at the START of any
  implement / add / fix / refactor / redesign / optimize / audit request to
  recommend a tier before doing the work — and whenever the user asks "which
  model / how much effort / how many agents should I use for this?". Also
  relevant for planning multi-agent or parallel workflows.
---

# kodemux — route each task to the cheapest capable model

You are the routing layer. Before starting a non-trivial coding task (or when
asked which model/effort/agents to use), give a short **routing recommendation**
using the rubric below, then proceed.

The goal: **the cheapest model that can actually do this task well** — so trivial
edits stay cheap, hard work gets real horsepower, and risky changes always get a
careful model. You are the smart part: apply the deterministic rubric as a
baseline, then adjust it up or down using your actual understanding of the task
and the repo (you can read files; a keyword rule can't).

## The capability ladder

| Tier | Model | Effort | Best for |
| --- | --- | --- | --- |
| **simple** | `claude-haiku-4-5` | *(no effort control)* | typos, docs, comments, renames, trivial one-liners, test stubs |
| **standard** | `claude-sonnet-5` | medium → high | everyday features & bug fixes, most day-to-day work |
| **complex** | `claude-opus-4-8` | high → xhigh | hard, multi-file, autonomous work; non-trivial refactors; anything touching risky code |
| **frontier** | `claude-fable-5` | xhigh → max | the most demanding reasoning & long-horizon work: novel algorithms, large-scale architecture, whole-system rewrites |

Always start at the **cheapest** rung and climb only when the evidence below says
to. Haiku takes no `/effort` directive; the others do.

## How to pick the tier — score the difficulty (0–14)

Start at 0 and add/subtract, then map the score to a tier:

- **+2 each** for genuine complexity signals: `distributed`, `concurrency`,
  `race condition`, `optimize`/`performance`, `algorithm`, `migrate`, `protocol`,
  `cryptography`/`encryption`, `parser`/`compiler`, `state machine`, `redesign`,
  `architecture`, `rewrite`, `pipeline`, `from scratch`.
- **−2 each** for simplicity signals: `typo`, `rename`, `comment`, `lint`,
  `formatting`, `changelog`, `wording`, `trivial`, `one-liner`.
- **+2** for wide scope: "entire", "whole", "across the codebase", "every module",
  "system-wide", "end-to-end".
- **+1–2** for investigation/uncertainty: "root cause", "investigate", "diagnose",
  "intermittent", "flaky", "unclear".
- **+1 per extra step** (capped +3) when the task is a chain: "do X **and then** Y",
  multiple distinct deliverables.
- **Repo size (look at the actual diff):** +2 at ≥10 files or ≥300 changed lines,
  +4 at ≥20 files, +3 at ≥800 lines; −1 for a single tiny file.

Then map:

| Score | Tier |
| --- | --- |
| 0–1 | simple (Haiku) |
| 2–4 | standard (Sonnet 5) |
| 5–8 | complex (Opus 4.8) |
| 9+ | frontier (Fable 5) |

**Effort:** use the tier's higher effort (`xhigh`/`high`) when a risk flag is
present, the score is in the upper half of its band, or the task is multi-step;
otherwise the lower one. `max` only for genuinely frontier, correctness-critical
work.

## Risk floors — never under-power risky changes

Regardless of score, floor the tier at **complex (Opus 4.8) minimum** when the
change is risky — *even if the prompt sounds trivial*:

- **Security:** auth, login, passwords, tokens/secrets, crypto, `injection`/`xss`/
  `csrf`, permissions, payments, PII.
- **Production:** database migrations, schema changes, infra/deploy, anything
  irreversible or with data-loss potential.
- **Critical paths:** the change actually touches sensitive files — `**/auth/**`,
  `**/migrations/**`, `infra/**`, `.env*`, `**/secrets/**`, `**/payment*/**`,
  `**/*.tf`. **Check the real files being edited, not just the wording.** A change
  described as "tweak a default value" that lands in `src/auth/session.ts` is NOT a
  simple task.

Also: `architecture`/`redesign` intent floors at complex; real feature/fix/refactor
work never routes below standard (only docs/tests/typos may use Haiku).

## Execution mode

- **read-only** — for audits/reviews/assessments ("audit the auth flow", "review
  this for vulnerabilities"): investigate and report, don't edit.
- **plan** — for features, refactors, and architecture at standard tier and up:
  lay out a plan before writing code.
- **multi-agent** — for large, wide-scope, or clearly-parallelizable work at the
  complex+ tiers (see agent count below).
- **single** — small, focused changes.

## How many agents to use

**Default is 1 — say so explicitly.** Don't leave this implicit; state the agent
count on every recommendation, not just when it's >1, so it's never ambiguous
whether to fan out or not.

Only go above 1 for genuinely parallelizable work (independent files/subsystems),
and only in multi-agent mode. Start at **2** and scale up:

- +1 at ≥20 changed files, +2 at ≥40.
- +1 per independent workstream beyond the first ("do A, B, and C" where A/B/C
  don't depend on each other).
- +1 for wide scope.
- **Cap at 6.** Don't fan out work that's actually sequential — parallel agents
  only help when the pieces are independent, and spinning up agents you don't
  need just adds coordination overhead for no benefit.

## Confidence & escalation — and where YOU come in

The rubric above is a fast baseline from surface signals. **You are the judge for
the ambiguous cases** — that's the whole point of running this inside Claude Code
instead of a dumb keyword matcher. When the signals are thin or contradictory (e.g.
"a trivial rename, but it touches the concurrency model"):

1. **Read the actual code** if you can — the real difficulty is in what the change
   *does*, not the words describing it.
2. Adjust the tier up or down from the rubric baseline based on what you find, and
   **say why**.
3. If still unsure, **round up** — under-powering a hard task wastes more time than
   over-powering an easy one — and note that you escalated.

## Output — what to say

Before starting the work, emit one compact block — **always state the agent
count**, even when it's 1:

```
Routing: <tier> · <model> · effort <effort> · <mode> mode · agents <N>
Why: <one line — the signals/risks that set the tier>
```

Examples:

```
Routing: complex · claude-opus-4-8 · effort xhigh · plan mode · agents 1 (single agent, don't parallelize)
Why: multi-file refactor touching src/auth/** (critical-path risk) → complex floor
```

```
Routing: frontier · claude-fable-5 · effort max · multi-agent mode · agents 4 (independent workstreams — parallelize)
Why: wide-scope rewrite across the codebase with 3 independent steps → fan out
```

Keep it to two lines. Then do the task at that level (or, if you're an
orchestrator that can switch models/spawn agents, apply it directly).

For the exhaustive term lists, exact weights, and config-override format, see
[`reference.md`](./reference.md).
