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

# 3. Route some tasks — watch the model/effort/mode change with intent
codemux route "fix a typo in the README"
#   intent docs      → claude-haiku-4-5 / low  / single
codemux route "refactor the whole billing architecture"
#   intent architecture → claude-fable-5 / xhigh / multi-agent
codemux route "add a CSV export endpoint"
#   intent feature   → claude-sonnet-5 / high / plan   (+ /plan directive)

# 4. Repo signals override keywords for big changes
codemux route "touch a few things" --files 30 --diff-lines 900
#   intent architecture (large change heuristic)

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
