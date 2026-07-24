# codemux — Product & Implementation Plan

Open-source, repo-native middleware and hook engine that sits between developer prompts and AI coding tools (Claude Code, Cursor, custom agents). It auto-detects repo context, routes each task to the optimal model/effort/mode, and enforces git-level guardrails before and after code generation.

---

## 1. Problem & Solution

**Problem.** AI tools now expose a large matrix of models (Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5), effort levels (`low`/`medium`/`high`/`xhigh`), and modes (single vs. multi-agent). Developers overspend on overkill models for trivial edits and underpower complex architectural work — and there's no consistent guardrail layer.

**Solution.** A lightweight CLI installed via `curl` into any repo. It classifies intent, augments the prompt with the right routing directives, and runs pre/post hooks (secrets scan, context limits, branch protection, auto-format, scoped tests).

**Non-goals (v1).** Not a proxy for the LLM API, not a billing dashboard, not an IDE plugin. It emits routing directives and runs shell hooks — it does not replace the agent runtime.

---

## 2. Architecture

```
[ Developer Prompt ]
        │
        ▼
┌──────────────────────────────────────────────┐
│              codemux                │
│  1. Intent Classifier → (Model + Effort + Mode)│
│  2. Pre-Hooks → secrets, context limit, branch │
└───────────────────┬──────────────────────────┘
                    │ augmented prompt + directives
                    ▼
┌──────────────────────────────────────────────┐
│        AI Execution Agent (Claude Code, …)    │
└───────────────────┬──────────────────────────┘
                    │ file changes / tool output
                    ▼
┌──────────────────────────────────────────────┐
│  3. Post-Hooks → format, lint, scoped tests    │
│  4. Guardrails → block breaking diffs          │
└──────────────────────────────────────────────┘
```

---

## 3. Router Matrix

| Task intent | Model | Effort | Mode |
| --- | --- | --- | --- |
| System architecture / massive refactor | `claude-fable-5` | `xhigh` | Multi-agent orchestration |
| Standard feature / multi-file edit | `claude-sonnet-5` | `high` | Plan mode |
| Quick bug fix / inline edit | `claude-sonnet-5` | `medium` | Single agent |
| Docs / test generation | `claude-haiku-4-5` | `low` | Fast single agent |
| Security / production review | `claude-fable-5` | `high` | Read-only audit |

All rows are overridable in `middleware.config.json`. Model IDs above match the current model strings; keep them in one constants file so a model rename is a one-line change.

---

## 4. Features

**F1 — One-command install & bootstrap.** `curl -fsSL <raw-url>/install.sh | sh`. Detects stack (Node/TS, Python, Go, Docker, monorepo), scaffolds `.middleware/`, generates `middleware.config.json` and a synthesized `CLAUDE.md`.

**F2 — Smart router.** Rule-based classifier first (keyword + file-count + diff-size heuristics); optional fast-model fallback (Haiku) for ambiguous prompts. Emits `/model`, `/effort`, `/plan` directives.

**F3 — Guardrail hooks.**
- *Pre:* secrets scan (`ghp_*`, `sk-*`, AWS keys), context/file-size limiter, branch protection (no direct edits to `main`/`production`).
- *Post:* auto-format + lint on touched files (prettier/eslint/black/golangci-lint), scoped test run for modified files, breaking-diff guard.

**F4 — Modular skills.** `/smart-plan` (read-only architecture plan first), `/cheap-edit` (force Haiku/medium), `/ultracode-audit` (multi-agent security + perf scan).

---

## 5. Generated Layout

```
.middleware/
├── middleware.config.json   # model/effort/cost/hook overrides
├── bin/router               # CLI wrapper
├── hooks/
│   ├── pre-prompt.sh        # secrets + intent classifier
│   └── post-tool.sh         # lint, tests, diff verifier
├── skills/
│   ├── smart-plan.md
│   ├── ultracode-audit.md
│   └── cheap-edit.md
└── templates/CLAUDE.md
```

---

## 6. Roadmap

**Phase 1 — CLI core & installer.** Scaffold a TypeScript (Node/Bun) CLI. Write `install.sh` (download, chmod, link into PATH / `.git/hooks`). Implement `middleware init` to scan deps and write default config.

**Phase 2 — Classifier & routing.** Rule-based + heuristic classifier with optional Haiku fallback. Keyword parsing ("refactor", "audit", "fix typo", "add tests"). Output routing directives.

**Phase 3 — Hooks engine.** `pre-prompt`: secrets regex + file-size filter. `post-tool`: detect modified files via `git status`, run language-appropriate formatters/linters and scoped tests.

**Phase 4 — Docs & tests.** `--interactive` setup, unit/integration tests for classification and hooks, example demo repo.

---

## 7. Tech decisions (lock before coding)

- **Language:** TypeScript on Bun (fast startup, single-binary via `bun build --compile`). Fallback: Go if a zero-dependency static binary is preferred.
- **Config:** JSON with a JSON Schema for validation and editor autocomplete.
- **Directory name:** `.middleware/` (avoids clashing with tool-owned `.claude/`).
- **Distribution:** GitHub raw `install.sh` for v1; npm package later.

---

## 8. First coding steps

1. `bun init` in this folder; add `commander` (or `citty`) for CLI parsing.
2. Create `src/constants/models.ts` with the router matrix.
3. Implement `middleware init` (stack detection + scaffold writer).
4. Write `install.sh` and test end-to-end in a throwaway repo.
5. Add the classifier module with unit tests, then wire the hooks.

**Open questions:** TS/Bun vs. Go? `.middleware/` vs. `.claude/`? Ship the config JSON Schema and a ready-to-run `install.sh` next?
