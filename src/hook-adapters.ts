/**
 * Claude Code hook adapters.
 *
 * These turn kodemux's existing, already-tested command cores (`route`,
 * `guard`, `scan`) into Claude Code hook responses — the JSON shape Claude
 * Code's hook runner reads from stdout (context-injection hooks) or expects on
 * a block (exit 2 + a `decision` JSON on stderr). Pure functions: given a hook
 * payload, they return a plain object describing what to print and what exit
 * code to use — no stdin/stdout/process I/O here, so they're testable with
 * plain objects. The CLI (`src/cli.ts`) is the only layer that touches
 * process streams.
 *
 * Why this exists instead of the AI-assist network call (src/ai-judge.ts):
 * inside Claude Code, the model reading this hook's output *is* the reasoning
 * layer — no separate API key, no network call, no credential setup. The
 * deterministic router still does the scoring; Claude Code supplies the
 * judgment for ambiguous cases directly, using the repo context it already has
 * from its own tools.
 */
import { runRoute } from './commands/route.js';
import { runGuard } from './commands/guard.js';
import { runScan } from './commands/scan.js';

/** Minimal shape of a Claude Code hook payload (fields kodemux actually reads). */
export interface HookPayload {
  cwd?: string;
  prompt?: string;
  tool_name?: string;
  tool_input?: {
    command?: string;
    file_path?: string;
    notebook_path?: string;
  };
}

export interface HookResult {
  /** JSON to print to stdout (context-injection hooks) or undefined for a block. */
  stdout?: string;
  /** JSON to print to stderr, only set when blocking. */
  stderr?: string;
  exitCode: 0 | 2;
}

const CONTEXT_HEADER =
  'kodemux routing recommendation (deterministic — verify against your own read of the repo before deferring to it):';

/**
 * `UserPromptSubmit` hook. Runs the zero-network deterministic router on the
 * submitted prompt and injects the recommendation as additional context.
 * Never blocks — routing advice is informational, not enforced.
 */
export async function userPromptSubmitHook(payload: HookPayload): Promise<HookResult> {
  const cwd = payload.cwd ?? process.cwd();
  const prompt = payload.prompt ?? '';
  if (!prompt.trim()) return { exitCode: 0 };

  // No AI-assist here — Claude Code itself supplies judgment for ambiguous
  // cases when it reads this context, so the hook stays instant and free.
  const out = await runRoute(cwd, prompt, { ai: false, json: true });
  let decision: any;
  try {
    decision = JSON.parse(out.text);
  } catch {
    return { exitCode: 0 };
  }

  const effort = decision.target && decision.target.effort;
  const lines = [
    CONTEXT_HEADER,
    `  tier ${decision.tier} · model ${decision.target?.model} · effort ${effort ?? 'n/a'} · mode ${decision.target?.mode}`,
  ];
  if (decision.risks && decision.risks.length) {
    lines.push(`  risk flags: ${decision.risks.join(', ')}`);
  }
  lines.push(
    decision.target && decision.target.mode === 'multi-agent'
      ? `  agents: ${decision.parallelAgents} — genuinely parallelizable (independent files/workstreams); split it across ${decision.parallelAgents} agents instead of running it serially.`
      : `  agents: 1 — do not parallelize this; a single agent working sequentially is enough, extra agents would just add coordination overhead.`,
  );
  if (decision.confidence < 0.6) {
    lines.push(
      `  confidence ${decision.confidence} — deterministic signal is thin here; use your own read of the repo to confirm or override this tier.`,
    );
  }

  const stdout = JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: lines.join('\n'),
    },
  });
  return { stdout, exitCode: 0 };
}

/** Does this Bash command look like a commit (the point secrets/branch matter)? */
export function isCommitCommand(command: string): boolean {
  return /(^|;|&&|\|\|)\s*git\s+commit\b/.test(command);
}

/**
 * `PreToolUse` hook for the Bash tool. Blocks a `git commit` when the branch
 * is protected or the staged/working changes contain a secret — turning the
 * existing advisory `guard`/`scan` commands into enforced guardrails.
 */
export async function preToolUseHook(payload: HookPayload): Promise<HookResult> {
  const cwd = payload.cwd ?? process.cwd();
  if (payload.tool_name !== 'Bash') return { exitCode: 0 };

  const command = payload.tool_input?.command ?? '';
  if (!isCommitCommand(command)) return { exitCode: 0 };

  const guard = runGuard(cwd);
  if (guard.exitCode !== 0) {
    return {
      stderr: JSON.stringify({ decision: 'block', reason: `kodemux guard: ${guard.text}` }),
      exitCode: 2,
    };
  }

  const scan = runScan(cwd);
  if (scan.exitCode !== 0) {
    return {
      stderr: JSON.stringify({ decision: 'block', reason: `kodemux scan: ${scan.text}` }),
      exitCode: 2,
    };
  }

  return { exitCode: 0 };
}
