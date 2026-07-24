# codemux — example walkthrough

A 60-second tour of codemux in a throwaway repo.

```sh
# 1. Set up a demo repo
mkdir demo && cd demo && git init
echo '{"name":"demo"}' > package.json

# 2. Bootstrap codemux
codemux init
# → Detected stack: node
#   created  .codemux/config.json
#   created  .codemux/CLAUDE.md

# 3. Route some tasks — watch the tier climb with estimated complexity
codemux route "fix a typo in the README"
#   simple   → claude-haiku-4-5  / (no effort) / single
codemux route "add a CSV export endpoint"
#   standard → claude-sonnet-5   / medium / plan
codemux route "audit the auth flow for vulnerabilities"
#   complex  → claude-opus-4-8   / xhigh / read-only   [risk: security]
codemux route "design a distributed rate limiter from scratch, optimize latency"
#   frontier → claude-fable-5    / max   / plan

# 4. Repo size feeds the complexity score (and can trigger parallel agents)
codemux route "reorganize the app" --files 40 --diff-lines 1200
#   frontier → claude-fable-5 / max / multi-agent  (→ /agents 5)

# 5. Guardrails
git checkout -b feat/export
codemux guard          # ok — feature branch
echo 'TOKEN=ghp_realtokenwouldgohere...' > secrets.env
codemux scan           # exit 1 — flags the token (masked)

# 6. Plan the post-hooks for what you changed
codemux post           # dry-run: prettier/eslint/npm test for changed .ts files
codemux post --run     # actually run them
```

## Using route as middleware

```sh
DECISION=$(codemux route "$PROMPT" --json)
MODEL=$(echo "$DECISION" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).target.model))')
# → pass $MODEL to your agent invocation
```
