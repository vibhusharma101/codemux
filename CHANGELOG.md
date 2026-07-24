# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.5] - 2026-07-25

### Fixed

- **Definitive install method.** On Windows, npm global installs (both
  `-g github:...` and `-g .`) *symlink* to the source rather than copy, so the
  command breaks if that folder is removed. README now documents the method
  verified end-to-end: clone (keep the folder), `npm install`, `npm link` — the
  global `kodemux` links to the persistent clone. No compile step (build is
  committed).

## [0.4.4] - 2026-07-25

### Fixed

- **Install docs corrected to the method that actually works everywhere.**
  `npm install -g github:...` leaves a broken symlink on Windows (npm points the
  global package at a temp git-clone dir that is then deleted). README now leads
  with the reliable clone + `npm install -g .` method — no compile step, since the
  build is committed — and marks the one-liner as macOS/Linux-only. Verified
  end-to-end on Windows.

## [0.4.3] - 2026-07-25

### Fixed

- **GitHub install now actually works.** v0.4.2's `prepare`-script approach failed
  on a global git install (`npm install -g github:...`) because npm doesn't install
  devDependencies — so `tsc` wasn't available and the build crashed. The compiled
  `dist/` is now **committed to the repo**, so a GitHub install needs no build step
  and no dev toolchain. CI verifies `dist/` is never stale (`git diff --exit-code
  dist` after a build). Removed the `prepare` script.

## [0.4.2] - 2026-07-25

### Added

- **One-line install from GitHub.** A `prepare` script now compiles the project on
  install, so `npm install -g github:vibhusharma101/kodemux` clones, builds, and
  puts a global `kodemux` command on your PATH — cross-platform (macOS/Linux/
  Windows) and usable inside the Claude Code terminal, no manual build step.
- README documents the GitHub install and a **Credentials** section explaining how
  AI-assist reuses an existing `ANTHROPIC_API_KEY` / `ant auth login` session (and
  that everything else needs no credentials).

## [0.4.1] - 2026-07-25

Code-review hardening pass — bug fixes and robustness, no behavior change for
correct configs.

### Fixed

- **Crash on partial tier config override.** A `.kodemux/config.json` that
  overrode a tier's `model` without also specifying `efforts` (a documented,
  supported shape) dropped `efforts` on a shallow merge and crashed the router
  with "Cannot read properties of undefined". `loadConfig` now deep-merges each
  tier so a partial override keeps the base `efforts`; `route()` also falls back
  defensively if a hand-built policy omits the field.

### Changed

- **AI judge is now SDK/model-portable.** The judge no longer depends on
  structured-output (`output_config.format`) support; it asks for a JSON object
  and parses it tolerantly (handles surrounding prose), so it works across SDK
  and model versions instead of silently no-op-ing where structured outputs
  aren't honored.
- **`kodemux post --run` closes a shell-injection surface.** It refuses to
  execute a format/lint step whose changed-file path contains shell
  metacharacters (e.g. a file named `foo;rm -rf ~.ts`), skipping it with a clear
  message instead of interpolating it into a shell command.
- Named the post-AI-assist confidence constant (`AI_ASSISTED_CONFIDENCE`).
- Explainer page: surfaces the parallel-agent recommendation more prominently
  (dedicated `agents` row + hero copy) — kodemux plans the whole run (model,
  effort, mode, *and* how many agents), not just the model.
- 5 new regression tests (79 → **84**).

## [0.4.0] - 2026-07-24

AI-assisted escalation — an optional, cheap second opinion for the ambiguous
minority of prompts the deterministic router isn't confident about.

### Added

- **AI-assisted escalation**, on by default. When the deterministic router's
  confidence is below `escalateBelowConfidence` (same threshold that already
  gated the escalation cascade), `kodemux route` now makes **one** cheap call to
  `claude-haiku-4-5` to get a real semantic read on the task before falling back
  to the plain deterministic guess.
  - **Reuses existing credentials** — `new Anthropic()` with no arguments resolves
    whatever is already configured (`ANTHROPIC_API_KEY` or an `ant auth login`
    profile). No separate API key or account to set up.
  - The judge can only **raise** complexity/risk found by the deterministic pass
    — never lower it — so the merged decision stays explainable and auditable.
  - **Always fails safe.** No credentials, a network error, an 8-second timeout,
    a model refusal, or a malformed response all fall back to the deterministic
    result silently — the CLI never crashes, hangs, or blocks on it.
  - Disable with `--no-ai` or `router.aiAssist: false` in config.
- `src/ai-judge.ts` — `judgeComplexity()` / `judgeWithClient()`, split for
  dependency-injected testing (no real network calls in the test suite).
- `route()` gains an optional `aiHint` parameter and `RouteResult.aiAssisted`;
  the deterministic core (`analyze`/`route`) remains fully synchronous and pure
  — only the CLI orchestration layer is async and only it touches the network.
- `route --json` now includes an `aiAssist` block (`attempted`, `applied`,
  and either the judge's result or the skip reason) for full transparency.
- Config schema v3 adds `router.aiAssist` (default `true`).
- 16 new tests (was 63, now **79**): judge parsing/clamping/error-handling with a
  mocked client, router-level `aiHint` merge behavior, and CLI-level orchestration
  with an injected fake judge.

### Changed

- New dependency: `@anthropic-ai/sdk`.

## [0.3.1] - 2026-07-24

### Changed

- **Renamed the project from `codemux` to `kodemux`.** The package/CLI is now
  `kodemux`, the generated config directory is `.kodemux/`, and the repo lives at
  `github.com/vibhusharma101/kodemux`. No behavior changes beyond the name — if you
  scaffolded a `.codemux/` directory with a prior version, rename it to `.kodemux/`.

## [0.3.0] - 2026-07-24

Real repo context — the router now reads the actual diff, not just the prompt.

### Added

- **Automatic git context.** `kodemux route` now runs `git diff` to derive the
  real number of changed files and diff lines from the working tree (or a
  `--base <ref>` range), instead of relying on manually supplied `--files` /
  `--diff-lines`. Those flags still work as overrides; `--no-git` disables
  detection.
- **Critical-path detection.** A change touching a high-blast-radius path (auth,
  migrations, infra, `.env*`, secrets, payments/billing, `*.tf`) raises a new
  `critical` risk flag and floors the tier — *even when the prompt text never
  mentions it*. Patterns are configurable via `router.criticalPaths` (glob).
- `src/glob.ts` — a dependency-free glob matcher (`**`, `*`, `?`) for path rules.
- `git.parseNumstat()` / `git.repoContext()` — tested diff-stat helpers.

### Changed

- Config schema adds `router.criticalPaths`.
- `route --json` now includes a `detected` object (files, diff lines, paths, base).
- Explainer gains a "touches a critical path" toggle demonstrating the new flag.

## [0.2.0] - 2026-07-24

Router overhaul — a robust, multi-signal capability-ladder router.

### Changed

- **`kodemux route` now estimates task complexity and routes on a capability
  ladder** (Haiku 4.5 → Sonnet 5 → **Opus 4.8** → Fable 5) instead of a fixed
  intent→model table. Model choice is driven by a 0–14 complexity score built from
  many additive signals (complexity/simplicity terms, scope, multi-step structure,
  repo size) plus risk flags — not a keyword lookup.
- **Opus 4.8 added** to the ladder (previously absent); **Fable 5** is now reserved
  for genuinely frontier-complexity work rather than any "refactor".
- Effort levels extended to include `max`; Haiku correctly emits **no** `/effort`
  directive (it has no effort control).

### Added

- **Risk flags & floors** — security/production-sensitive prompts floor at the
  `complex` (Opus) tier; audits route to `read-only` mode.
- **Confidence + escalation cascade** — low-confidence routes recommend the next
  tier up ("escalate if the agent stalls / the change is larger than estimated").
- **Parallel-agent recommendation** — multi-agent work emits `/agents N`, scaled by
  files touched, independent steps, and scope.
- Config schema **v2**: overridable tier models/efforts, complexity thresholds,
  `riskFloor`, and `escalateBelowConfidence`.
- Interactive explainer rewritten around the new engine (complexity meter, tier
  ladder, risk pills, confidence bar, escalation), ported line-for-line and
  parity-checked against the compiled router.

## [0.1.0] - 2026-07-24

Initial release — the full v1 CLI: routing plus pre/post guardrails.

### Added

- **CLI core** (`kodemux`) on Node + TypeScript, compiled to `dist/` and exposed
  as a `bin`.
- **`kodemux init`** — marker-based stack detection (node, typescript, python, go,
  rust, docker, monorepo) and idempotent `.kodemux/` scaffold (config + synthesized
  `CLAUDE.md`); `--force` to overwrite.
- **`kodemux route <prompt>`** — deterministic keyword + repo-signal classifier that
  maps a prompt to an intent and emits `/model` · `/effort` · `/plan`|`/mode`
  directives from an overridable router matrix. `--files`, `--diff-lines`, `--json`.
- **`kodemux guard`** — pre-hook branch protection (configurable protected list).
- **`kodemux scan`** — pre-hook secrets scanner (GitHub PAT/classic, OpenAI, AWS,
  Slack, Google API key, PEM private key) with masked findings.
- **`kodemux post`** — post-hook scoped format/lint/test planner (dry-run by default,
  `--run` to execute).
- **Config loader** with defaults + partial-config merging.
- **43 unit tests** (node:test) and CI on Node 20 & 22.
- **`install.sh`** source installer and example walkthrough.

### Notes

- Implemented on Node + TypeScript rather than Bun (per PLAN.md), and the generated
  directory is `.kodemux/` rather than `.middleware/`.

[0.4.5]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.4.5
[0.4.4]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.4.4
[0.4.3]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.4.3
[0.4.2]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.4.2
[0.4.1]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.4.1
[0.4.0]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.4.0
[0.3.1]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.3.1
[0.3.0]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.3.0
[0.2.0]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.2.0
[0.1.0]: https://github.com/vibhusharma101/kodemux/releases/tag/v0.1.0
