# kodemux routing reference

Exhaustive term lists, weights, and the config-override format. `SKILL.md` has
the working rubric; this is the full detail for when you need exact values. These
mirror the deterministic kodemux CLI (`kodemux route`) so the skill and the CLI
agree — if you have the CLI installed you can also run `kodemux route "<task>"
--json` for a mechanical baseline.

## Complexity terms (+2 each)

```
distributed, concurrency, concurrent, race condition, deadlock, threading,
multithread, async, parallel, algorithm, optimize, optimization, performance,
scalability, throughput, latency, architecture, redesign, design, migrate,
migration, rewrite, overhaul, protocol, consensus, cryptography, encryption,
compiler, parser, state machine, memory leak, end-to-end, pipeline, orchestrate,
rearchitect, from scratch
```

## Simplicity terms (−2 each)

```
typo, rename, comment, formatting, lint, whitespace, bump, changelog, readme,
spelling, wording, indent, reword, one-liner, trivial
```

## Scope terms (+2 if any present)

```
entire, whole, across the, codebase, system-wide, everywhere, all files,
throughout, every module, end-to-end
```

## Uncertainty terms (+1 each, capped +2)

```
investigate, root cause, figure out, diagnose, unknown, unclear, not sure,
why is, reproduce, intermittent, flaky
```

## Multi-step connectors (+1 each, capped +3)

```
and then, then, also, afterwards, followed by, ;
```

## Risk term lists

**Security** → `security` risk flag:
```
security, secure, auth, authentication, authorization, vulnerability,
vulnerabilities, exploit, owasp, cve, injection, xss, csrf, crypto,
cryptography, password, secret, token, payment, pii, gdpr
```

**Production** → `production` risk flag:
```
production, deploy, release, irreversible, rollback, breaking change, data loss,
schema change, database migration, db migration, downtime
```

## Critical-path globs → `critical` risk flag

A change is critical if any **changed file path** matches (check the real diff,
not the wording):
```
**/auth/**, **/migrations/**, infra/**, .env*, **/secrets/**, **/payment*/**,
**/billing/**, **/*.tf
```

## Repo-size weighting

| Signal | Adjustment |
| --- | --- |
| files changed ≥ 40 | +4 |
| files changed ≥ 20 | +3 (net; from the ≥10 rule + the ≥20 bump) |
| files changed ≥ 10 | +2 |
| files changed ≤ 1 | −1 |
| diff lines ≥ 800 | +3 |
| diff lines ≥ 300 | +2 |
| diff lines ≤ 20 | −1 |

## Tier thresholds & floors

- score ≥ 9 → **frontier** · ≥ 5 → **complex** · ≥ 2 → **standard** · else **simple**
- Any risk flag (security / production / critical) → floor **complex** (Opus 4.8).
- `architecture`/`redesign` intent → floor **complex**.
- feature / bugfix / refactor intent → floor **standard** (never Haiku).
- docs / tests / typos → may use **simple** (Haiku).
- Final complexity is clamped to `[0, 14]`.

## Effort per tier `[base, boosted]`

| Tier | base | boosted |
| --- | --- | --- |
| simple (Haiku) | — | — |
| standard (Sonnet 5) | medium | high |
| complex (Opus 4.8) | high | xhigh |
| frontier (Fable 5) | xhigh | max |

Use **boosted** when: a risk flag is present, OR the score is in the upper half of
the complex→frontier range, OR the task is multi-step at complex tier or above.

## Parallel-agent count (multi-agent mode only)

Outside multi-agent mode the count is always **1** — state it explicitly rather
than omitting it, so it's never ambiguous whether to fan out.

```
start = 2
+1 if files changed ≥ 20 ; +2 if ≥ 40
+1 per independent step beyond the first (capped +2)
+1 if wide scope
clamp to [2, 6]
```

## Config overrides

If a repo has a `.kodemux/config.json` (from the kodemux CLI's `init`), honor its
overrides: `router.tiers.<tier>.model` / `.efforts`, `router.thresholds`,
`router.riskFloor`, and `router.criticalPaths`. Example:

```jsonc
{
  "router": {
    "tiers": { "complex": { "model": "claude-opus-4-8", "efforts": ["high", "xhigh"] } },
    "thresholds": { "standard": 2, "complex": 5, "frontier": 9 },
    "riskFloor": "complex",
    "criticalPaths": ["**/auth/**", "**/migrations/**", "infra/**", ".env*"]
  }
}
```

## Model IDs (exact strings)

`claude-haiku-4-5` · `claude-sonnet-5` · `claude-opus-4-8` · `claude-fable-5`
