# codemux

> Repo-native middleware & guardrail engine for AI coding tools.

`codemux` sits between your prompts and your AI coding agent (Claude Code, Cursor,
custom agents). It auto-detects repo context, **routes** each task to the optimal
model / effort / mode, and enforces **git-level guardrails** before and after code
generation.

```
[ prompt ] → codemux (classify + pre-hooks) → [ AI agent ] → codemux (post-hooks + guardrails) → [ commit ]
```

> **Status:** in active development. See [`PLAN.md`](./PLAN.md) for the full product
> spec and roadmap. Built as a Node + TypeScript CLI.

## Why

AI tools expose a large matrix of models (Fable 5, Opus 4.8, Sonnet 5, Haiku 4.5),
effort levels (`low`→`xhigh`), and modes (single vs. multi-agent). Teams overspend
on overkill models for trivial edits, underpower complex work, and lack a consistent
guardrail layer. `codemux` makes the routing decision explicit and repeatable, and
adds secrets/branch/test guardrails around every change.

## Install

```sh
npm install -g codemux    # (published in a later phase)
# or run without installing:
npx codemux --help
```

## Quick start

```sh
codemux init                 # detect stack, scaffold .codemux/ + config
codemux route "fix a typo in the README"
codemux scan                 # secrets scan of staged/working changes
codemux guard                # branch-protection check
```

Full command reference lands with the docs release. See `PLAN.md` for architecture.

## License

MIT © Vibhu Sharma
