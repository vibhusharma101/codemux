# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-24

Initial release — the full v1 CLI: routing plus pre/post guardrails.

### Added

- **CLI core** (`codemux`) on Node + TypeScript, compiled to `dist/` and exposed
  as a `bin`.
- **`codemux init`** — marker-based stack detection (node, typescript, python, go,
  rust, docker, monorepo) and idempotent `.codemux/` scaffold (config + synthesized
  `CLAUDE.md`); `--force` to overwrite.
- **`codemux route <prompt>`** — deterministic keyword + repo-signal classifier that
  maps a prompt to an intent and emits `/model` · `/effort` · `/plan`|`/mode`
  directives from an overridable router matrix. `--files`, `--diff-lines`, `--json`.
- **`codemux guard`** — pre-hook branch protection (configurable protected list).
- **`codemux scan`** — pre-hook secrets scanner (GitHub PAT/classic, OpenAI, AWS,
  Slack, Google API key, PEM private key) with masked findings.
- **`codemux post`** — post-hook scoped format/lint/test planner (dry-run by default,
  `--run` to execute).
- **Config loader** with defaults + partial-config merging.
- **43 unit tests** (node:test) and CI on Node 20 & 22.
- **`install.sh`** source installer and example walkthrough.

### Notes

- Implemented on Node + TypeScript rather than Bun (per PLAN.md), and the generated
  directory is `.codemux/` rather than `.middleware/`.

[0.1.0]: https://github.com/vibhusharma101/codemux/releases/tag/v0.1.0
