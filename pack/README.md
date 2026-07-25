# kodemux — drop-in pack for Claude Code

This folder is a **copy-paste integration** of kodemux for Claude Code. No app,
no install, no API key, no credentials. It's just a skill (markdown) and two tiny
hook scripts. Once the files are in your repo's `.claude/`, Claude Code itself
becomes the routing layer — it tells you (or decides) **which model, effort, mode,
and how many parallel agents** to use for each task, and refuses risky commits.

Because *Claude reading the skill is the reasoning layer*, there's nothing to
authenticate — it uses the Claude session you're already in.

---

## What you get

1. **A routing skill** (`.claude/skills/kodemux/`) — Claude applies a capability
   ladder (Haiku → Sonnet → Opus → Fable), scores task difficulty, floors risky
   changes to a capable model, and recommends a parallel-agent count. It loads
   automatically whenever you start a coding task or ask "which model / how many
   agents should I use?".
2. **A guardrail hook** (`.claude/hooks/kodemux-guard.*`) — blocks a `git commit`
   on a protected branch (`main`/`master`/`production`) or when the staged diff
   contains a secret-shaped string. Self-contained PowerShell + bash, no Node.

## Install (30 seconds)

From your project root, copy the `.claude` contents from this pack into your repo:

```sh
# macOS / Linux
cp -r path/to/kodemux/pack/.claude/skills/kodemux  .claude/skills/
cp -r path/to/kodemux/pack/.claude/hooks/kodemux-guard.sh  .claude/hooks/
```

```powershell
# Windows (PowerShell)
Copy-Item -Recurse path\to\kodemux\pack\.claude\skills\kodemux  .claude\skills\
Copy-Item path\to\kodemux\pack\.claude\hooks\kodemux-guard.ps1  .claude\hooks\
```

Then register the guardrail hook by **merging** the snippet in
[`.claude/settings.snippet.json`](./.claude/settings.snippet.json) into your
project's `.claude/settings.json` (create it if it doesn't exist). Use the command
line for your OS:

- **macOS / Linux:** `"bash .claude/hooks/kodemux-guard.sh"`
- **Windows:** `"powershell.exe -NoProfile -File .claude/hooks/kodemux-guard.ps1"`

A minimal `.claude/settings.json` on Windows looks like:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "powershell.exe -NoProfile -File .claude/hooks/kodemux-guard.ps1" }
        ]
      }
    ]
  }
}
```

If you already have hooks, just **add** the `Bash` group above alongside your
existing ones — don't replace the file.

Restart Claude Code (hooks load at session start). That's it.

## Using it

Just work normally. When you ask Claude to build/fix/refactor something, the skill
kicks in and you'll see a two-line routing recommendation before the work starts:

```
Routing: complex · claude-opus-4-8 · effort xhigh · plan mode
Why: multi-file refactor touching src/auth/** (critical-path risk) → complex floor
```

You can also ask directly: *"kodemux: which model and how many agents for
rewriting the storage engine?"*

And if you try to `git commit` on `main` or with a leaked key staged, the hook
stops it with a clear reason.

## Customizing

- **Routing rules** live in [`.claude/skills/kodemux/SKILL.md`](./.claude/skills/kodemux/SKILL.md)
  (the rubric) and [`reference.md`](./.claude/skills/kodemux/reference.md) (exact
  weights and term lists) — plain markdown, edit freely.
- **Protected branches / secret patterns** live at the top of the hook scripts.
- **Per-repo overrides** (custom tier models, thresholds, critical paths) can go in
  a `.kodemux/config.json`; the skill honors it (see reference.md).

## Want the mechanical version too?

This pack is the zero-setup, Claude-native path. There's also a full **kodemux
CLI** (`kodemux route`, `scan`, `guard`, `post`) that computes the same routing
deterministically and can be wired into git hooks — see the
[main repo](https://github.com/vibhusharma101/kodemux). The pack and the CLI use
the same rubric, so they agree.
