/**
 * `kodemux route "<prompt>"` — analyze a prompt and emit routing directives.
 *
 * Repo context (files changed, diff size, critical-path hits) is read
 * automatically from git; `--files` / `--diff-lines` override the auto-detected
 * counts, and `--no-git` disables detection entirely.
 *
 * When the deterministic pass is unsure, an optional AI-assist step (on by
 * default) consults a cheap Haiku judge — reusing whatever Anthropic
 * credentials are already configured — before falling back to the plain
 * escalation cascade. `--no-ai` disables this step.
 *
 * `--max-tier` / `--max-effort` let a developer cap the routed tier/effort
 * for this one prompt without editing `.kodemux/config.json` — the router
 * still runs its full analysis, the cap only clamps the result downward.
 */
import { defaultRouterPolicy, loadConfig, withProvider } from '../config.js';
import { route, type RouteCap, type RouteResult } from '../router.js';
import { repoContext } from '../git.js';
import { judgeComplexity, type JudgeOutcome } from '../ai-judge.js';
import type { Signals } from '../classify.js';
import {
  EFFORTS,
  PROVIDERS,
  TIERS,
  type Effort,
  type Provider,
  type Tier,
} from '../constants/models.js';

export interface RouteCommandOptions {
  files?: string;
  diffLines?: string;
  json?: boolean;
  /** Diff against a base ref (e.g. `main`) instead of the working tree. */
  base?: string;
  /** Commander sets this to false for `--no-git`. */
  git?: boolean;
  /** Commander sets this to false for `--no-ai`. */
  ai?: boolean;
  /** Cap the routed tier at or below this, for this invocation only. */
  maxTier?: string;
  /** Cap the effort directive at or below this, for this invocation only. */
  maxEffort?: string;
  /** Emit directives for this agent (`claude` | `codex`), this invocation only. */
  provider?: string;
}

export interface RouteCommandOutput {
  text: string;
  exitCode: number;
}

/** Injectable dependencies — the judge is swapped for a fake in tests. */
export interface RouteCommandDeps {
  judge?: typeof judgeComplexity;
}

/**
 * Core: takes cwd + prompt + options, returns text to print and an exit code.
 * Side effects are reading git state (skippable via `--no-git`) and, only when
 * confidence is low, one AI-assist call (skippable via `--no-ai`) — both fail
 * safe and never throw.
 */
export async function runRoute(
  cwd: string,
  prompt: string,
  opts: RouteCommandOptions = {},
  deps: RouteCommandDeps = {},
): Promise<RouteCommandOutput> {
  if (!prompt || !prompt.trim()) {
    return { text: 'kodemux route: a prompt is required', exitCode: 1 };
  }

  let cap: RouteCap | undefined;
  if (opts.maxTier !== undefined) {
    if (!TIERS.includes(opts.maxTier as Tier)) {
      return {
        text: `kodemux route: --max-tier must be one of ${TIERS.join(', ')}`,
        exitCode: 1,
      };
    }
    cap = { ...cap, maxTier: opts.maxTier as Tier };
  }
  if (opts.maxEffort !== undefined) {
    if (!EFFORTS.includes(opts.maxEffort as Effort)) {
      return {
        text: `kodemux route: --max-effort must be one of ${EFFORTS.join(', ')}`,
        exitCode: 1,
      };
    }
    cap = { ...cap, maxEffort: opts.maxEffort as Effort };
  }

  if (opts.provider !== undefined && !PROVIDERS.includes(opts.provider as Provider)) {
    return {
      text: `kodemux route: --provider must be one of ${PROVIDERS.join(', ')}`,
      exitCode: 1,
    };
  }

  const loaded = loadConfig(cwd);
  // `--provider` retargets the ladder for this invocation only — never written
  // back to disk, and hand-pinned tier models are preserved (see withProvider).
  const policy = opts.provider
    ? withProvider(loaded?.router ?? defaultRouterPolicy(), opts.provider as Provider)
    : loaded?.router;
  const config = policy ? { router: policy } : undefined;

  const useGit = opts.git !== false;
  const ctx = useGit ? repoContext(cwd, opts.base) : null;

  const signals: Signals = {};
  if (opts.files !== undefined) signals.fileCount = Number(opts.files);
  else if (ctx && ctx.fileCount > 0) signals.fileCount = ctx.fileCount;

  if (opts.diffLines !== undefined) signals.diffLines = Number(opts.diffLines);
  else if (ctx && ctx.diffLines > 0) signals.diffLines = ctx.diffLines;

  if (ctx && ctx.paths.length) signals.paths = ctx.paths;

  let result: RouteResult = route(prompt, config, signals, undefined, cap);
  let judgeOutcome: JudgeOutcome | null = null;

  const aiEnabled = opts.ai !== false && (config?.router.aiAssist ?? true);
  const threshold = config?.router.escalateBelowConfidence ?? 0.6;
  if (aiEnabled && result.confidence < threshold) {
    const judge = deps.judge ?? judgeComplexity;
    judgeOutcome = await judge(prompt, signals);
    if (judgeOutcome.ok) {
      result = route(
        prompt,
        config,
        signals,
        {
          complexity: judgeOutcome.result.complexity,
          risks: judgeOutcome.result.risks,
          rationale: judgeOutcome.result.rationale,
        },
        cap,
      );
    }
  }

  if (opts.json) {
    const detected = ctx
      ? { fileCount: ctx.fileCount, diffLines: ctx.diffLines, paths: ctx.paths, base: opts.base ?? null }
      : null;
    const aiAssist = judgeOutcome
      ? judgeOutcome.ok
        ? { attempted: true, applied: true, ...judgeOutcome.result }
        : { attempted: true, applied: false, reason: judgeOutcome.reason }
      : { attempted: false, applied: false };
    return { text: JSON.stringify({ ...result, detected, aiAssist }, null, 2), exitCode: 0 };
  }

  const effort = result.target.effort ?? 'n/a (model has no effort control)';
  const lines = [
    `intent      ${result.intent}`,
    `complexity  ${result.complexity}/14`,
    `tier        ${result.tier}${result.risks.length ? `  [risk: ${result.risks.join(', ')}]` : ''}${result.capped ? '  (capped — see "why")' : ''}`,
    `confidence  ${result.confidence}${result.aiAssisted ? '  (ai-assisted)' : ''}`,
  ];

  if (ctx && ctx.paths.length) {
    const where = opts.base ? `git vs ${opts.base}` : 'git working tree';
    lines.push(
      `context     ${ctx.fileCount} changed file(s), ~${ctx.diffLines} diff lines (${where})`,
    );
  }

  if (judgeOutcome && !judgeOutcome.ok) {
    lines.push(`ai-assist   skipped (${judgeOutcome.reason})`);
  }

  lines.push(
    '',
    `provider    ${result.provider}`,
    `model       ${result.target.model}`,
    `effort      ${effort}`,
    `mode        ${result.target.mode}`,
    `agents      ${result.parallelAgents}${result.target.mode === 'multi-agent' ? '  (parallelize — independent workstreams)' : '  (single agent — do not parallelize)'}`,
    '',
    'directives:',
    ...result.directives.map((d) => `  ${d}`),
  );

  if (result.invocation) {
    lines.push('', 'or launch directly:', `  ${result.invocation}`);
  }

  if (result.escalation) {
    lines.push(
      '',
      'escalate to:',
      `  ${result.escalation.model}${result.escalation.effort ? ` @ ${result.escalation.effort}` : ''} (${result.escalation.tier}) — ${result.escalation.trigger}`,
    );
  }

  lines.push('', 'why:', ...result.reasons.map((r) => `  - ${r}`));
  return { text: lines.join('\n'), exitCode: 0 };
}
