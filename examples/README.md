# kodemux — example walkthrough

A 60-second tour of kodemux in a throwaway repo.

```sh
# 1. Set up a demo repo
mkdir demo && cd demo && git init
echo '{"name":"demo"}' > package.json

# 2. Bootstrap kodemux
kodemux init
# → Detected stack: node
#   created  .kodemux/config.json
#   created  .kodemux/CLAUDE.md

# 3. Route some tasks — watch the tier climb with estimated complexity
kodemux route "fix a typo in the README"
#   simple   → claude-haiku-4-5  / (no effort) / single
kodemux route "add a CSV export endpoint"
#   standard → claude-sonnet-5   / medium / plan
kodemux route "audit the auth flow for vulnerabilities"
#   complex  → claude-opus-4-8   / xhigh / read-only   [risk: security]
kodemux route "design a distributed rate limiter from scratch, optimize latency"
#   frontier → claude-fable-5    / max   / plan

# 4. Repo size feeds the complexity score (and can trigger parallel agents)
kodemux route "reorganize the app" --files 40 --diff-lines 1200
#   frontier → claude-fable-5 / max / multi-agent  (→ /agents 5)

# 5. Guardrails
git checkout -b feat/export
kodemux guard          # ok — feature branch
echo 'TOKEN=ghp_realtokenwouldgohere...' > secrets.env
kodemux scan           # exit 1 — flags the token (masked)

# 6. Plan the post-hooks for what you changed
kodemux post           # dry-run: prettier/eslint/npm test for changed .ts files
kodemux post --run     # actually run them
```

## Using route as middleware

```sh
DECISION=$(kodemux route "$PROMPT" --json)
MODEL=$(echo "$DECISION" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).target.model))')
# → pass $MODEL to your agent invocation
```
