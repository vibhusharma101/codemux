# codemux

> Repo-native middleware & guardrail engine for AI coding tools.

`codemux` sits between your prompts and your AI coding agent (Claude Code, Cursor,
custom agents). It auto-detects repo context, **routes** each task to the optimal
model / effort / mode, and enforces **git-level guardrails** before and after code
generation.

```
[ prompt ] → codemux (classify + pre-hooks) → [ AI agent ] → codemux (post-hooks + guardrails) → [ commit ]
```

Built as a dependency-light **Node + TypeScript** CLI. See [`PLAN.md`](./PLAN.md)
for the full product spec and [`docs/INTERNALS.md`](./docs/INTERNALS.md) for how
the router actually works under the hood.

> 🌐 **[Try the interactive explainer →](https://vibhusharma101.github.io/codemux/)** —
> drive the real router, secrets scan, and branch guard in your browser. No install.

---

## Why

AI tools expose a large matrix of models (Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5),
effort levels (`low` → `xhigh`), and modes (single vs. multi-agent). Teams overspend
on overkill models for trivial edits, underpower complex work, and lack a consistent
guardrail layer. `codemux` makes the routing decision **explicit, repeatable, and
overridable**, and wraps every change in secrets / branch / test guardrails.

---

## Install

**npm (once published):**

```sh
npm install -g codemux
# or, no install:
npx codemux --help
```

**Curl installer (installs from source):**

```sh
curl -fsSL https://raw.githubusercontent.com/vibhusharma101/codemux/main/install.sh | sh
```

The installer clones the repo to `~/.codemux-src`, builds it, and links the
`codemux` binary into `~/.local/bin` (override with `CODEMUX_BIN`). Requires
**Node ≥ 20** and **git**.

**From source:**

```sh
git clone https://github.com/vibhusharma101/codemux.git
cd codemux && npm install && npm run build
node dist/cli.js --help
```

---

## Quick start

```sh
codemux init                              # detect stack, scaffold .codemux/
codemux route "refactor the auth module"  # → model/effort/mode directives
codemux guard                             # branch-protection check
codemux scan                              # secrets scan of changed files
codemux post                              # plan scoped format/lint/test
```

---

## Commands

| Command | Purpose |
| --- | --- |
| `codemux init [--force]` | Detect the repo stack and scaffold `.codemux/` (config + synthesized `CLAUDE.md`). |
| `codemux route <prompt> [--files n] [--diff-lines n] [--json]` | Estimate complexity, pick a tier on the capability ladder, and emit `/model` · `/effort` · `/mode` (· `/agents N`) directives with a confidence + escalation. |
| `codemux guard` | **Pre-hook.** Refuse direct edits on a protected branch. Exit 1 to block. |
| `codemux scan [--json]` | **Pre-hook.** Scan changed files for secret-shaped strings. Exit 1 on a hit. |
| `codemux post [--run] [--json]` | **Post-hook.** Plan (dry-run) or run scoped format/lint/test for changed files. |

### Routing

codemux routes on a **capability ladder** — it picks the cheapest model that can
handle the task, then floors upward for risk and escalates when unsure. This is a
deterministic rule engine (no LLM call): free, instant, testable, reproducible.

**How the decision is made:**

1. **Estimate complexity (0–14)** from many additive signals — not a keyword→model
   lookup. Complexity terms (`distributed`, `concurrency`, `optimize`, `migrate`…),
   scope (`entire`, `across the codebase`), multi-step structure, and repo size
   (`--files` / `--diff-lines`) all move the score; simplicity terms (`typo`,
   `rename`, `lint`…) move it down.
2. **Pick the tier** by threshold, then apply floors:

   | Tier | Model | Reaches at | Effort | Best for |
   | --- | --- | --- | --- | --- |
   | `simple` | `claude-haiku-4-5` | complexity 0–1 | — (no effort control) | docs, tests, mechanical edits |
   | `standard` | `claude-sonnet-5` | ≥ 2 | medium → high | everyday features & fixes |
   | `complex` | `claude-opus-4-8` | ≥ 5 | high → xhigh | hard, multi-file, autonomous work |
   | `frontier` | `claude-fable-5` | ≥ 9 | xhigh → max | most demanding reasoning & long-horizon work |

   *Floors:* any **security/production** risk → `complex` (Opus) minimum ·
   `architecture` intent → `complex` · features/fixes/refactors never route below
   `standard`. Haiku takes no `/effort` directive.
3. **Choose the mode & parallelism** — audits are `read-only`; large, wide-scope or
   multi-step work at the `complex`+ tiers becomes `multi-agent` with a recommended
   **number of parallel agents** (`/agents N`, scaled by files/steps/scope).
4. **Confidence & escalation** — a confidence score gates a **cascade**: when the
   router isn't sure, it recommends the next tier up ("escalate to X if the agent
   stalls or the change proves larger than estimated") rather than guessing.

```sh
$ codemux route "fix a typo in the README"
intent      docs
complexity  0/14
tier        simple
confidence  0.69

model       claude-haiku-4-5
effort      n/a (model has no effort control)
mode        single

$ codemux route "refactor the entire architecture" --files 40 --diff-lines 1200
tier        frontier          model  claude-fable-5   effort  max
mode        multi-agent  (5 agents in parallel)   →  /agents 5
```

`--json` emits the full decision (tier, complexity, risks, confidence, escalation,
parallelAgents, directives) for use as middleware in an agent wrapper. Every tier,
threshold, and floor is overridable in `.codemux/config.json`.

> **Why rule-based, not an LLM judge?** Deterministic routing is the standard fast
> path (cf. RouteLLM's lightweight routers, ~sub-second classifiers) — no latency,
> no cost, fully testable. The "let a smarter model decide" behavior lives in the
> escalation cascade; an optional LLM-judge for genuinely ambiguous prompts is
> planned (see `PLAN.md` §4, F2).

---

## Configuration

`codemux init` writes `.codemux/config.json`. Every field is optional — missing
values fall back to defaults, so you can hand-edit a partial config.

```jsonc
{
  "version": 2,
  "stack": ["node", "typescript"],
  "router": {
    "tiers": {
      // swap the model or efforts for any rung of the ladder
      "complex": { "model": "claude-opus-4-8", "efforts": ["high", "xhigh"] }
    },
    "thresholds": { "standard": 2, "complex": 5, "frontier": 9 },
    "riskFloor": "complex",           // min tier when security/production risk is present
    "escalateBelowConfidence": 0.6    // cascade to the next tier below this confidence
  },
  "hooks": {
    "pre":  { "secretsScan": true, "branchProtection": ["main", "master", "production"] },
    "post": { "format": true, "lint": true, "scopedTests": true }
  }
}
```

---

## Wiring into your agent / git

`guard` and `scan` are exit-code hooks — drop them into a git `pre-commit` hook or
your agent's PreToolUse hook:

```sh
# .git/hooks/pre-commit
codemux guard || exit 1
codemux scan  || exit 1
```

Run `post` after a change to auto-format and test only what was touched:

```sh
codemux post --run
```

Use `route --json` inside an agent wrapper to pick the model before dispatching.

---

## Development

```sh
npm install
npm run typecheck   # tsc --noEmit
npm run build       # tsc → dist/
npm test            # node:test via tsx
```

CI runs typecheck + build + tests on Node 20 & 22. See [`CHANGELOG.md`](./CHANGELOG.md).

---

## License

MIT © Vibhu Sharma
