#!/usr/bin/env bash
# kodemux guardrail — Claude Code PreToolUse hook (Bash matcher), macOS/Linux.
#
# Self-contained: no Node, no kodemux binary. Blocks a `git commit` when the
# current branch is protected or the staged diff contains a secret-shaped
# string. Reads the hook payload as JSON from stdin.
#
# Protocol: exit 2 + {"decision":"block","reason":...} on stderr = block the
# tool call; exit 0 = allow. Never blocks on anything other than git commit.

payload="$(cat)"

# Extract fields — prefer jq, fall back to grep/sed if jq isn't installed.
if command -v jq >/dev/null 2>&1; then
  tool="$(printf '%s' "$payload" | jq -r '.tool_name // empty')"
  cmd="$(printf '%s' "$payload" | jq -r '.tool_input.command // empty')"
  cwd="$(printf '%s' "$payload" | jq -r '.cwd // empty')"
else
  tool="$(printf '%s' "$payload" | grep -o '"tool_name"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')"
  cmd="$(printf '%s' "$payload" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"command"[[:space:]]*:[[:space:]]*"//; s/"$//')"
  cwd="$(printf '%s' "$payload" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*"\([^"]*\)"$/\1/')"
fi

[ "$tool" = "Bash" ] || exit 0
[ -n "$cmd" ] || exit 0

# Only act on `git commit`.
printf '%s' "$cmd" | grep -Eq '(^|;|&&|\|\|)[[:space:]]*git[[:space:]]+commit([[:space:]]|$)' || exit 0

[ -n "$cwd" ] || cwd="$(pwd)"

block() {
  printf '{"decision":"block","reason":"kodemux guard: %s"}\n' "$1" >&2
  exit 2
}

# 1. Protected-branch check. Edit this list, or read it from .kodemux/config.json.
branch="$(git -C "$cwd" rev-parse --abbrev-ref HEAD 2>/dev/null)"
case " main master production " in
  *" $branch "*)
    block "refusing to commit directly on protected branch '$branch'. Create a feature branch first: git checkout -b feat/your-change" ;;
esac

# 2. Secret-shaped strings in the staged diff.
diff="$(git -C "$cwd" diff --cached 2>/dev/null)"
if [ -n "$diff" ]; then
  if printf '%s' "$diff" | grep -Eq 'ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{60,}|sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'; then
    block "the staged diff contains a secret-shaped string. Remove or vault it before committing."
  fi
fi

exit 0
