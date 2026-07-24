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
for the full product spec.

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
| `codemux route <prompt> [--files n] [--diff-lines n] [--json]` | Classify a prompt and emit `/model` · `/effort` · `/plan`\|`/mode` directives. |
| `codemux guard` | **Pre-hook.** Refuse direct edits on a protected branch. Exit 1 to block. |
| `codemux scan [--json]` | **Pre-hook.** Scan changed files for secret-shaped strings. Exit 1 on a hit. |
| `codemux post [--run] [--json]` | **Post-hook.** Plan (dry-run) or run scoped format/lint/test for changed files. |

### Routing

The classifier scores a prompt against keyword sets and repo signals, resolves an
**intent**, then looks it up in the router matrix:

| Intent | Model | Effort | Mode |
| --- | --- | --- | --- |
| `architecture` (refactor, redesign, large diff) | `claude-fable-5` | `xhigh` | `multi-agent` |
| `feature` (default — add / implement / build) | `claude-sonnet-5` | `high` | `plan` |
| `bugfix` (fix, crash, regression, tiny diff) | `claude-sonnet-5` | `medium` | `single` |
| `docs` (docs, README, tests, typo) | `claude-haiku-4-5` | `low` | `single` |
| `security` (audit, vulnerability, OWASP) | `claude-fable-5` | `high` | `read-only` |

`--files` / `--diff-lines` bias the decision (a 30-file change routes to
`architecture` even without keywords). Every row is overridable in the config.

```sh
$ codemux route "fix a typo in the README"
intent      docs (confidence 0.67)
model       claude-haiku-4-5
effort      low
mode        single

directives:
  /model claude-haiku-4-5
  /effort low
  /mode single
```

`--json` emits the full decision for use as middleware in an agent wrapper.

---

## Configuration

`codemux init` writes `.codemux/config.json`. Every field is optional — missing
values fall back to defaults, so you can hand-edit a partial config.

```jsonc
{
  "version": 1,
  "stack": ["node", "typescript"],
  "router": {
    "docs": { "model": "claude-haiku-4-5", "effort": "low", "mode": "single" }
    // …one row per intent; override any of them
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
