# kodemux guardrail — Claude Code PreToolUse hook (Bash matcher), Windows.
#
# Self-contained: no Node, no kodemux binary. Blocks a `git commit` when the
# current branch is protected or the staged diff contains a secret-shaped
# string. Reads the hook payload as JSON from stdin.
#
# Protocol: exit 2 + {"decision":"block","reason":...} on stderr = block the
# tool call; exit 0 = allow. Never blocks on anything other than git commit.

$ErrorActionPreference = 'SilentlyContinue'

try { $payload = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch { exit 0 }

if ($payload.tool_name -ne 'Bash') { exit 0 }
$cmd = $payload.tool_input.command
if (-not $cmd) { exit 0 }

# Only act on `git commit` (allow git anywhere else in a chain to pass).
if ($cmd -notmatch '(^|;|&&|\|\|)\s*git\s+commit\b') { exit 0 }

$cwd = $payload.cwd
if (-not $cwd) { $cwd = (Get-Location).Path }

function Block([string]$reason) {
    $msg = @{ decision = 'block'; reason = "kodemux guard: $reason" } | ConvertTo-Json -Compress
    [Console]::Error.WriteLine($msg)
    exit 2
}

# 1. Protected-branch check. Edit this list, or read it from .kodemux/config.json.
$protected = @('main', 'master', 'production')
$branch = (& git -C $cwd rev-parse --abbrev-ref HEAD 2>$null)
if ($branch) {
    $branch = $branch.Trim()
    if ($protected -contains $branch) {
        Block "refusing to commit directly on protected branch '$branch'. Create a feature branch first: git checkout -b feat/your-change"
    }
}

# 2. Secret-shaped strings in the staged diff.
$diff = (& git -C $cwd diff --cached 2>$null)
if ($diff) {
    $patterns = [ordered]@{
        'github-token'      = 'ghp_[A-Za-z0-9]{36}'
        'github-pat'        = 'github_pat_[A-Za-z0-9_]{60,}'
        'openai-key'        = 'sk-[A-Za-z0-9]{20,}'
        'aws-access-key-id' = 'AKIA[0-9A-Z]{16}'
        'slack-token'       = 'xox[baprs]-[A-Za-z0-9-]{10,}'
        'google-api-key'    = 'AIza[0-9A-Za-z_-]{35}'
        'private-key'       = '-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
    }
    foreach ($name in $patterns.Keys) {
        if ($diff -match $patterns[$name]) {
            Block "the staged diff contains a secret-shaped string [$name]. Remove or vault it before committing."
        }
    }
}

exit 0
