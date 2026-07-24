# How codemux works internally

This document explains the internal design of codemux's router (and, briefly, its
guardrail hooks) — the part of the product that decides *which model, effort, and
mode* to use for a given task. It assumes you've read the [README](../README.md)
for the product pitch; this is the "how," not the "why buy it."

Source of truth for everything below: `src/`. If this doc and the code disagree,
the code wins — file an issue.

---

## 1. Architecture at a glance

```
prompt
   │        ┌─────────────────────────────┐
   │        │  repoContext()  src/git.ts  │  runs `git diff` → changed files,
   │        │  → RepoContext              │  diff lines, and changed paths
   │        └──────────────┬──────────────┘
   ▼                       ▼
┌───────────────────────────────────────┐
│  analyze()             src/classify.ts │  pure function, no I/O, no network
│  → Analysis object                     │  intent, complexity, risk, scope, steps
└───────────────────┬───────────────────┘
                    ▼
┌───────────────────────────────────────┐
│  route()               src/router.ts   │  applies POLICY from .codemux/config.json
│  → RouteResult object                  │  + critical-path check on changed paths
└───────────────────┬───────────────────┘
                    │ tier, model, effort, mode, parallelAgents, confidence, escalation
                    ▼
┌───────────────────────────────────────┐
│  runRoute() / CLI  src/commands/route.ts, src/cli.ts
│  → text or --json                      │  reads git, then calls the pure core
└───────────────────────────────────────┘
```

`analyze()` and `route()` are **pure functions** — same inputs, same output, no I/O.
The *only* impurity is `repoContext()` (it shells out to `git`) and loading the
config file, both confined to the CLI layer and both skippable (`--no-git`). That
purity is what makes the 63-test suite exhaustive and lets the interactive web
explainer (`docs/index.html`) run the *exact same routing logic* client-side with
zero backend — it just can't run git, so it accepts the file/diff/path signals
directly instead of deriving them.

---

## 2. Why not "ask an LLM which model to use"?

A tempting design is: send the prompt to a cheap model and ask it to pick the
right model for the *next* call. codemux deliberately doesn't do this by default,
for reasons grounded in how production LLM routers are built (RouteLLM, and
similar cost/quality routing systems):

| Approach | Latency | Cost | Determinism |
|---|---|---|---|
| LLM-as-judge router | +1–5s per prompt | an extra model call, every time | non-reproducible — same prompt can route differently twice |
| **Rule-based router (codemux)** | ~1ms | free | fully deterministic, testable, and overridable |

The trade-off rule-based routing makes is that it can't *understand* a prompt the
way an LLM can — it can only look at surface signals (keywords, scope, size). To
compensate, codemux doesn't try to be right on the first guess and stop there. It
does two things a naive keyword-matcher doesn't:

1. **Estimates a numeric complexity score from many signals**, not a single
   keyword→model lookup (see §4). This is closer to how real routers work: a
   lightweight classifier estimates difficulty, not intent-matching.
2. **Ships a confidence score and an escalation recommendation** (§6). When the
   signals are thin or contradictory, codemux says so explicitly — "escalate to
   Opus if this stalls" — instead of pretending to be sure.

An LLM-judge fallback for genuinely ambiguous prompts is a documented future
extension (see `PLAN.md` §4, F2) — but it would sit *behind* this deterministic
layer, not replace it, so the common case stays instant and free.

---

## 3. The capability ladder

Everything routes onto one of four tiers, defined in `src/constants/models.ts`:

| Tier | Model | Effort range | Best for |
|---|---|---|---|
| `simple` | `claude-haiku-4-5` | *(none — Haiku has no effort parameter)* | docs, typos, mechanical edits |
| `standard` | `claude-sonnet-5` | `medium` → `high` | everyday features & bug fixes |
| `complex` | `claude-opus-4-8` | `high` → `xhigh` | hard, multi-file, autonomous work |
| `frontier` | `claude-fable-5` | `xhigh` → `max` | the most demanding reasoning & long-horizon agentic work |

This is a **ladder**, not a lookup table — the router always starts at the
cheapest rung and only climbs when the evidence says it has to. Every model
string lives in exactly one file (`src/constants/models.ts`) so a provider rename
or price change is a one-line edit.

Each tier stores a `[base, boosted]` effort pair. The router picks `boosted` when
a risk flag is present, the complexity score is in the upper half of the tier's
band, or (for `complex`+) the task is multi-step. Haiku's pair is `[null, null]`
— the router knows to omit the `/effort` directive entirely rather than emit an
invalid one (Haiku 4.5 has no effort control at all).

---

## 4. `analyze()` — turning a prompt into signals

`src/classify.ts` is the estimator. Given a prompt string and optional repo
signals (`fileCount`, `diffLines`), it returns an `Analysis`:

```ts
interface Analysis {
  intent: Intent;              // docs | test | bugfix | feature | refactor | architecture | security
  complexity: number;          // 0..14
  risks: RiskFlag[];           // 'security' | 'production'
  scopeWide: boolean;          // "entire codebase", "every module", ...
  multiStep: boolean;          // "X and then Y", "; ", ...
  steps: number;               // count of step connectors — drives parallelism
  complexityHits: string[];    // matched hard-signal terms, for transparency
  simplicityHits: string[];    // matched easy-signal terms
  intentHits: string[];
  reasons: string[];           // human-readable trace of every adjustment
}
```

### 4.1 Intent — a keyword vote with a tie-break priority

Seven intents each have a keyword bank (e.g. `security` → `audit`, `owasp`,
`vulnerability`, `csrf`...). Every keyword hit is word-boundary matched
(`\bterm\b`, case-insensitive) and scored. The intent with the highest score
wins; ties are broken by a fixed priority order —
`security > architecture > refactor > feature > bugfix > test > docs` — so
ambiguity leans toward the more cautious/capable classification. If nothing
matches at all, intent defaults to `feature`.

Intent is *not* used to pick the model directly (that was the old, brittle
design). It's used for two narrower things: an **intent floor** (§5) and
**mode selection** (§7).

### 4.2 Complexity score — additive, not categorical

This is the actual difficulty estimate, built by adding/subtracting points for
independent signals found in the prompt text and repo signals:

| Signal | Effect | Examples |
|---|---|---|
| Complexity terms | **+2 each** | `distributed`, `concurrency`, `race condition`, `optimize`, `migrate`, `protocol`, `cryptography`, `parser`, `state machine` |
| Simplicity terms | **−2 each** | `typo`, `rename`, `lint`, `formatting`, `changelog`, `trivial` |
| Wide scope | **+2** | `entire`, `whole`, `across the`, `codebase`, `everywhere`, `system-wide` |
| Investigation/uncertainty | **+1 each, capped +2** | `investigate`, `root cause`, `diagnose`, `unclear`, `flaky`, `intermittent` |
| Multi-step structure | **+1 per connector, capped +3** | `"and then"`, `"; "`, `"also"`, `"followed by"` |
| Files touched | **+2 at ≥10, +4 at ≥20, −1 at ≤1** | auto from `git diff` (or `--files`) |
| Diff size | **+2 at ≥300, +3 at ≥800, −1 at ≤20** | auto from `git diff` (or `--diff-lines`) |

The files-touched and diff-size numbers are **read from the repo automatically**
— see §4.5. The raw total is clamped to `[0, 14]`. This is why "add error handling" — the
canonical example of a prompt that keyword-matching gets wrong — routes
correctly either way: on its own it scores 0 (no signal either direction, so it
lands at the cheapest tier its *intent floor* allows), but "add error handling
with exponential backoff and circuit breakers across the distributed pipeline"
picks up `distributed` (+2), `pipeline` (+2), and wide scope (+2) and jumps
several tiers — same starting phrase, correctly different outcomes.

### 4.3 Risk flags — independent of complexity

Security and production risk are tracked **separately** from the complexity
score, because a request can be security-sensitive without being *complex*
("rotate this one API key" is easy but must never route to a model with a lower
review bar). Risk flags are matched against their own term lists
(`RISK_SECURITY_TERMS`, `RISK_PRODUCTION_TERMS`) and feed a **floor** in the
router, not the score.

### 4.4 Reasons — every adjustment is logged

Every point added or subtracted pushes a human-readable string onto `reasons`.
This is what powers the `why:` section of `codemux route` output and the "why
this route" panel in the web explainer — the estimate is never a black box.

### 4.5 Real repo context — `repoContext()` and critical paths

The router doesn't only read the prompt string. `src/commands/route.ts` calls
`repoContext()` (`src/git.ts`) before routing, which runs `git diff` and returns:

```ts
interface RepoContext {
  fileCount: number;   // real count of changed files (working tree, or a base…HEAD range)
  diffLines: number;   // real added+deleted line count, from `git diff --numstat`
  paths: string[];     // the actual changed file paths
}
```

Those numbers feed the complexity signals in §4.2 — so "clean up the router code"
scores differently when 2 files changed vs when 40 did, *without you telling it*.
`--files` / `--diff-lines` override the auto-detected values; `--base <ref>` diffs
a whole branch range instead of the working tree; `--no-git` turns detection off.
If the directory isn't a git repo (or has no commits), `repoContext()` returns
`null` and the router falls back to prompt-only.

**Critical paths.** The `paths` list is matched (in `route()`) against
`policy.criticalPaths` — a set of glob patterns for high-blast-radius locations
(`**/auth/**`, `**/migrations/**`, `infra/**`, `.env*`, `**/secrets/**`,
`**/payment*/**`, `**/*.tf`, …). A match raises a **`critical` risk flag**, which
— like security/production risk — floors the tier. This is how a change described
only as "tweak a default value" still routes to Opus if it lands in
`src/auth/session.ts`: the *diff* reveals what the *prompt* didn't. Matching uses
a small dependency-free glob engine in `src/glob.ts` (supports `**`, `*`, `?`,
anchored to path-segment boundaries so `auth/` matches `src/auth/x` but not
`src/myauth/x`).

---

## 5. `route()` — from signals to a decision

`src/router.ts` takes the `Analysis` and a `RouterPolicy` (from config or
defaults) and produces the final `RouteResult`.

### 5.1 Base tier from thresholds

```
complexity ≥ frontier threshold (default 9)  → frontier
complexity ≥ complex threshold  (default 5)  → complex
complexity ≥ standard threshold (default 2)  → standard
otherwise                                     → simple
```

### 5.2 Floors — never let intent or risk under-route

Two floors apply *after* the threshold pick, always pushing the tier **up**,
never down:

- **Intent floor** (`INTENT_FLOOR` in `router.ts`): `feature`, `bugfix`, and
  `refactor` never go below `standard` — a "simple" complexity score alone
  can't send real code work to Haiku. `architecture` floors at `complex`.
- **Risk floor** (`policy.riskFloor`, default `complex`): any risk flag —
  `security`, `production`, or `critical` (a critical-path hit from the diff,
  §4.5) — guarantees at least the `complex` (Opus) tier, regardless of how
  simple the wording looks.

```ts
let tier = tierFromComplexity(a.complexity, policy);
if (INTENT_FLOOR[a.intent]) tier = maxTier(tier, INTENT_FLOOR[a.intent]);
if (a.risks.length) tier = maxTier(tier, policy.riskFloor);
```

### 5.3 Effort boost

Within the chosen tier's `[base, boosted]` effort pair, `boosted` is used when:

- a risk flag is present, or
- the complexity score sits in the upper half of the complex→frontier band, or
- the tier is `complex` or higher **and** the request is multi-step.

### 5.4 Mode selection

```
security-audit wording (audit/review/assess)      → read-only
complex+ tier AND (wide scope OR multi-step)       → multi-agent
standard+ tier AND (multi-step OR feature/refactor/
                     architecture intent)          → plan
otherwise                                          → single
```

### 5.5 Parallel-agent count

Only meaningful in `multi-agent` mode. Starts at 2 and scales with:

- files touched (`+1` at ≥20, `+2` at ≥40),
- each additional independent step beyond the first (capped `+2`),
- wide scope (`+1`),

then clamps to `[2, 6]`. This becomes the `/agents N` directive.

### 5.6 Confidence

A heuristic 0–1 score, not a statistical one:

- starts at 0.5,
- **+** up to 0.35 for having more supporting reasons (more evidence = more sure),
- **+** 0.12 if the signals point cleanly one direction (all-simple or
  strongly-complex with no contradiction),
- **−** 0.2 if complexity and simplicity terms *both* fired (contradictory
  wording — e.g. "a trivial rename, but touches the concurrency model"),
- **−** 0.15 if the complexity score sits within 1 point of a tier boundary
  (a coin-flip case),
- reset to 0.25 if there was no signal at all (a pure default guess).

### 5.7 Escalation — the cascade

If confidence is below `policy.escalateBelowConfidence` (default `0.6`) and the
chosen tier isn't already the top of the ladder, codemux recommends — but does
not force — climbing one rung:

```json
"escalation": {
  "model": "claude-fable-5",
  "tier": "frontier",
  "trigger": "if the agent stalls, reports low confidence, or the change proves larger than estimated"
}
```

This is the deterministic router's answer to "what if I'm wrong": rather than
silently picking a possibly-underpowered model, it tells the caller exactly when
to bail up a tier.

---

## 6. Config overrides — `.codemux/config.json` (schema v2)

Everything in §3–§5 is a default in `defaultRouterPolicy()` (`src/config.ts`),
and every field can be overridden per-repo:

```jsonc
{
  "version": 2,
  "router": {
    "tiers": {
      "complex": { "model": "claude-opus-4-8", "efforts": ["high", "xhigh"] }
    },
    "thresholds": { "standard": 2, "complex": 5, "frontier": 9 },
    "riskFloor": "complex",
    "escalateBelowConfidence": 0.6
  }
}
```

`loadConfig()` merges a partial file over the defaults field-by-field, so a
config with just `{"router": {"thresholds": {"complex": 3}}}` is valid — every
other field falls back silently.

---

## 7. The CLI and guardrail hooks (brief)

Routing is the core, but three more commands wrap the same "pure function +
thin CLI shell" pattern:

- **`codemux scan`** (`src/scan.ts`) — regex-matches changed files against 7
  secret shapes (GitHub PAT, OpenAI key, AWS key, Slack token, Google API key,
  PEM private key), masks any match before printing it, exits 1 on a hit.
- **`codemux guard`** (`src/commands/guard.ts`) — refuses to proceed if the
  current branch is in the protected list (`main`, `master`, `production` by
  default).
- **`codemux post`** (`src/hooks.ts`) — groups changed files by language and
  plans `format` / `lint` / `test` steps; dry-run by default, `--run` executes.

All three read `git status --porcelain` through a single parser
(`src/git.ts`), so the porcelain-parsing logic is tested once and reused
everywhere, instead of each command re-implementing it.

---

## 8. Where to look for what

| Question | File |
|---|---|
| "Why did this prompt get this model?" | `src/classify.ts` (`analyze`) + `src/router.ts` (`route`) |
| "How does it read the repo?" | `src/git.ts` (`repoContext`, `parseNumstat`) |
| "How are critical paths matched?" | `src/glob.ts` + `router.criticalPaths` in `src/config.ts` |
| "What models/efforts exist?" | `src/constants/models.ts` |
| "What can I override in config?" | `src/config.ts` |
| "How does the CLI format the answer?" | `src/commands/route.ts` |
| "Does the web page match the CLI exactly?" | `docs/index.html` — the `<script>` is a line-for-line port of the routing logic (it can't run git, so it takes the signals directly) |
| "What's tested?" | `test/*.test.ts` — 63 tests across classify, router, config, glob, git, scan, guard, hooks, init |
