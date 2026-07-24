# kodemux

> Repo-native middleware & guardrail engine for AI coding tools.

`kodemux` sits between your prompts and your AI coding agent (Claude Code, Cursor,
custom agents). It auto-detects repo context, **routes** each task to the optimal
model / effort / mode, and enforces **git-level guardrails** before and after code
generation.

```
[ prompt ] → kodemux (classify + pre-hooks) → [ AI agent ] → kodemux (post-hooks + guardrails) → [ commit ]
```

Built as a dependency-light **Node + TypeScript** CLI. See [`PLAN.md`](./PLAN.md)
for the full product spec and [`docs/INTERNALS.md`](./docs/INTERNALS.md) for how
the router actually works under the hood.

> 🌐 **[Try the interactive explainer →](https://vibhusharma101.github.io/kodemux/)** —
> drive the real router, secrets scan, and branch guard in your browser. No install.

---

## Getting started (fresh machine)

New here? This is the fastest path from a clean checkout to a working `kodemux`
in **any** of your repos — verified end-to-end on Windows, macOS, and Linux, and
inside the Claude Code terminal. Requires **Node ≥ 20** and **git**.

```sh
# 1. Clone kodemux somewhere you'll keep — the global command links back to it
git clone https://github.com/vibhusharma101/kodemux.git
cd kodemux

# 2. Install runtime deps (no build step — the compiled dist/ is committed)
npm install

# 3. Link it globally
npm link

# 4. Confirm it's on your PATH
kodemux --version
```

Now go use it **in the project you actually want to route tasks for** — it does
not need to run from inside the kodemux folder:

```sh
cd /path/to/your-project
kodemux init                               # detects your stack, scaffolds .kodemux/
kodemux route "add a dark mode toggle"     # → model / effort / mode, with reasoning
kodemux guard                              # refuse edits on a protected branch
kodemux scan                               # secrets scan of your changed files
```

`kodemux route` reads your actual `git diff` automatically, so results reflect
what's really changed — not just the words in your prompt.

**Updating later:** `git pull` inside the cloned kodemux folder — no reinstall
needed. **Removing:** `npm rm -g kodemux`.

**Don't delete the cloned folder** — `npm link` points the global command back at
it; see [Install](#install) below for the platform-specific detail on why (a
Windows-specific npm quirk) and the alternatives (npm/curl/from-source).

**Want the AI-assisted step to fire too?** It's optional and needs no separate
setup — see [Credentials](#credentials-only-needed-for-ai-assist) below.

---

## Why

AI tools expose a large matrix of models (Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5),
effort levels (`low` → `xhigh`), and modes (single vs. multi-agent). Teams overspend
on overkill models for trivial edits, underpower complex work, and lack a consistent
guardrail layer. `kodemux` makes the routing decision **explicit, repeatable, and
overridable**, and wraps every change in secrets / branch / test guardrails.

---

## Install

**Clone & link (recommended — works everywhere, incl. Windows & the Claude Code
terminal).** The compiled build is committed, so there is **no compile step**.
Requires **Node ≥ 20**:

```sh
git clone https://github.com/vibhusharma101/kodemux.git   # keep this folder
cd kodemux
npm install        # runtime deps only (dist/ is already built)
npm link           # global `kodemux` command, linked to this folder
kodemux --version
```

> **Keep the cloned folder** — the global `kodemux` command links back to it.
> Update with `git pull` inside that folder (no reinstall needed). Remove with
> `npm rm -g kodemux`.

**One-liner from GitHub (macOS / Linux only).** Convenient, but **skip it on
Windows** — npm's global git-install leaves a broken symlink there; use the clone
method above:

```sh
npm install -g github:vibhusharma101/kodemux
```

**From npm (once published):**

```sh
npm install -g kodemux      # or: npx kodemux --help
```

**Curl installer (source, no npm global):**

```sh
curl -fsSL https://raw.githubusercontent.com/vibhusharma101/kodemux/main/install.sh | sh
```

Clones to `~/.kodemux-src`, builds, and links the binary into `~/.local/bin`
(override with `KODEMUX_BIN`). Requires Node ≥ 20 and git.

**From source (development):**

```sh
git clone https://github.com/vibhusharma101/kodemux.git
cd kodemux && npm install    # dist/ is already built and committed
node dist/cli.js --help
# after editing src/, rebuild with: npm run build
```

### Credentials (only needed for AI-assist)

Deterministic routing, guardrails, and everything else work with **no credentials
at all**. The optional AI-assist step (§ Routing, step 5) reuses whatever Anthropic
credentials the SDK can already resolve — an **`ANTHROPIC_API_KEY`** environment
variable, or an **`ant auth login`** session. Running kodemux inside the Claude
Code terminal: if you launched Claude Code with `ANTHROPIC_API_KEY` set, kodemux
subprocesses inherit it automatically; if you use OAuth/subscription login, run
`ant auth login` once (or export a key) so kodemux can authenticate. When no
credential is found, AI-assist simply skips and prints the reason — routing still
works.

---

## Quick start

```sh
kodemux init                              # detect stack, scaffold .kodemux/
kodemux route "refactor the auth module"  # → model/effort/mode directives
kodemux guard                             # branch-protection check
kodemux scan                              # secrets scan of changed files
kodemux post                              # plan scoped format/lint/test
```

---

## Commands

| Command | Purpose |
| --- | --- |
| `kodemux init [--force]` | Detect the repo stack and scaffold `.kodemux/` (config + synthesized `CLAUDE.md`). |
| `kodemux route <prompt> [--files n] [--diff-lines n] [--base ref] [--no-git] [--no-ai] [--json]` | Read git context, estimate complexity, pick a tier on the capability ladder, and emit `/model` · `/effort` · `/mode` (· `/agents N`) directives with a confidence + escalation. Consults a cheap AI judge for low-confidence routes unless `--no-ai`. |
| `kodemux guard` | **Pre-hook.** Refuse direct edits on a protected branch. Exit 1 to block. |
| `kodemux scan [--json]` | **Pre-hook.** Scan changed files for secret-shaped strings. Exit 1 on a hit. |
| `kodemux post [--run] [--json]` | **Post-hook.** Plan (dry-run) or run scoped format/lint/test for changed files. |

### Routing

kodemux routes on a **capability ladder** — it picks the cheapest model that can
handle the task, then floors upward for risk and escalates when unsure. This is a
deterministic rule engine (no LLM call): free, instant, testable, reproducible.

**How the decision is made:**

1. **Estimate complexity (0–14)** from many additive signals — not a keyword→model
   lookup. Complexity terms (`distributed`, `concurrency`, `optimize`, `migrate`…),
   scope (`entire`, `across the codebase`), multi-step structure, and **real repo
   size read automatically from `git diff`** (files changed + diff lines) all move
   the score; simplicity terms (`typo`, `rename`, `lint`…) move it down. `--files` /
   `--diff-lines` override the auto-detected numbers, `--base <ref>` diffs a branch
   range, and `--no-git` disables detection.
2. **Pick the tier** by threshold, then apply floors:

   | Tier | Model | Reaches at | Effort | Best for |
   | --- | --- | --- | --- | --- |
   | `simple` | `claude-haiku-4-5` | complexity 0–1 | — (no effort control) | docs, tests, mechanical edits |
   | `standard` | `claude-sonnet-5` | ≥ 2 | medium → high | everyday features & fixes |
   | `complex` | `claude-opus-4-8` | ≥ 5 | high → xhigh | hard, multi-file, autonomous work |
   | `frontier` | `claude-fable-5` | ≥ 9 | xhigh → max | most demanding reasoning & long-horizon work |

   *Floors:* any **security / production / critical-path** risk → `complex` (Opus)
   minimum · `architecture` intent → `complex` · features/fixes/refactors never
   route below `standard`. Haiku takes no `/effort` directive.

   A **critical-path** flag is raised when the *actual diff* touches a
   high-blast-radius location — auth, migrations, infra, `.env*`, secrets,
   payments, `*.tf` — **even if the prompt never mentions it** (a change described
   as "tweak a default value" still routes to Opus if it lands in `src/auth/`).
   Patterns are configurable via `router.criticalPaths`.
3. **Choose the mode & parallelism** — audits are `read-only`; large, wide-scope or
   multi-step work at the `complex`+ tiers becomes `multi-agent` with a recommended
   **number of parallel agents** (`/agents N`, scaled by files/steps/scope).
4. **Confidence & escalation** — a confidence score gates a **cascade**: when the
   router isn't sure, it recommends the next tier up ("escalate to X if the agent
   stalls or the change proves larger than estimated") rather than guessing.
5. **AI-assisted escalation (optional, on by default)** — when confidence is low,
   kodemux makes *one* cheap call to `claude-haiku-4-5` (reusing whatever
   Anthropic credentials are already on the machine — an `ANTHROPIC_API_KEY` or an
   `ant auth login` session, no separate setup) to get a real semantic read on the
   task, instead of falling straight back on the plain deterministic guess. The
   judge only ever *raises* the complexity/risk the deterministic pass found —
   never lowers it — so the merged decision stays explainable. Any failure (no
   credentials, network, timeout, refusal) falls back to the deterministic result
   silently — the CLI never crashes, hangs, or blocks on it. Disable entirely with
   `--no-ai` or `router.aiAssist: false` in config.

```sh
$ kodemux route "fix a typo in the README"
intent      docs
complexity  0/14
tier        simple
confidence  0.69

model       claude-haiku-4-5
effort      n/a (model has no effort control)
mode        single

$ kodemux route "refactor the entire architecture" --files 40 --diff-lines 1200
tier        frontier          model  claude-fable-5   effort  max
mode        multi-agent  (5 agents in parallel)   →  /agents 5
```

`--json` emits the full decision (tier, complexity, risks, confidence, escalation,
parallelAgents, directives) for use as middleware in an agent wrapper. Every tier,
threshold, and floor is overridable in `.kodemux/config.json`.

> **Why rule-based, not an LLM judge?** Deterministic routing is the standard fast
> path (cf. RouteLLM's lightweight routers, ~sub-second classifiers) — no latency,
> no cost, fully testable. The "let a smarter model decide" behavior lives in the
> escalation cascade; an optional LLM-judge for genuinely ambiguous prompts is
> planned (see `PLAN.md` §4, F2).

---

## Configuration

`kodemux init` writes `.kodemux/config.json`. Every field is optional — missing
values fall back to defaults, so you can hand-edit a partial config.

```jsonc
{
  "version": 3,
  "stack": ["node", "typescript"],
  "router": {
    "tiers": {
      // swap the model or efforts for any rung of the ladder
      "complex": { "model": "claude-opus-4-8", "efforts": ["high", "xhigh"] }
    },
    "thresholds": { "standard": 2, "complex": 5, "frontier": 9 },
    "riskFloor": "complex",           // min tier when any risk flag is present
    "escalateBelowConfidence": 0.6,   // cascade / consult the AI judge below this confidence
    "criticalPaths": ["**/auth/**", "**/migrations/**", "infra/**", ".env*"],
    "aiAssist": true                 // set false to disable the AI-judge escalation entirely
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
kodemux guard || exit 1
kodemux scan  || exit 1
```

Run `post` after a change to auto-format and test only what was touched:

```sh
kodemux post --run
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
