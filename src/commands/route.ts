/**
 * `kodemux route "<prompt>"` — analyze a prompt and emit routing directives.
 *
 * Repo context (files changed, diff size, critical-path hits) is read
 * automatically from git; `--files` / `--diff-lines` override the auto-detected
 * counts, and `--no-git` disables detection entirely.
 */
import { loadConfig } from '../config.js';
import { route } from '../router.js';
import { repoContext } from '../git.js';
import type { Signals } from '../classify.js';

export interface RouteCommandOptions {
  files?: string;
  diffLines?: string;
  json?: boolean;
  /** Diff against a base ref (e.g. `main`) instead of the working tree. */
  base?: string;
  /** Commander sets this to false for `--no-git`. */
  git?: boolean;
}

export interface RouteCommandOutput {
  text: string;
  exitCode: number;
}

/**
 * Pure command core: takes cwd + prompt + options, returns text to print and an
 * exit code. The only side effect is reading git state (skippable via `--no-git`).
 */
export function runRoute(
  cwd: string,
  prompt: string,
  opts: RouteCommandOptions = {},
): RouteCommandOutput {
  if (!prompt || !prompt.trim()) {
    return { text: 'kodemux route: a prompt is required', exitCode: 1 };
  }

  const config = loadConfig(cwd) ?? undefined;

  const useGit = opts.git !== false;
  const ctx = useGit ? repoContext(cwd, opts.base) : null;

  const signals: Signals = {};
  if (opts.files !== undefined) signals.fileCount = Number(opts.files);
  else if (ctx && ctx.fileCount > 0) signals.fileCount = ctx.fileCount;

  if (opts.diffLines !== undefined) signals.diffLines = Number(opts.diffLines);
  else if (ctx && ctx.diffLines > 0) signals.diffLines = ctx.diffLines;

  if (ctx && ctx.paths.length) signals.paths = ctx.paths;

  const result = route(prompt, config, signals);

  if (opts.json) {
    const detected = ctx
      ? { fileCount: ctx.fileCount, diffLines: ctx.diffLines, paths: ctx.paths, base: opts.base ?? null }
      : null;
    return { text: JSON.stringify({ ...result, detected }, null, 2), exitCode: 0 };
  }

  const effort = result.target.effort ?? 'n/a (model has no effort control)';
  const lines = [
    `intent      ${result.intent}`,
    `complexity  ${result.complexity}/14`,
    `tier        ${result.tier}${result.risks.length ? `  [risk: ${result.risks.join(', ')}]` : ''}`,
    `confidence  ${result.confidence}`,
  ];

  if (ctx && ctx.paths.length) {
    const where = opts.base ? `git vs ${opts.base}` : 'git working tree';
    lines.push(
      `context     ${ctx.fileCount} changed file(s), ~${ctx.diffLines} diff lines (${where})`,
    );
  }

  lines.push(
    '',
    `model       ${result.target.model}`,
    `effort      ${effort}`,
    `mode        ${result.target.mode}${result.target.mode === 'multi-agent' ? `  (${result.parallelAgents} agents in parallel)` : ''}`,
    '',
    'directives:',
    ...result.directives.map((d) => `  ${d}`),
  );

  if (result.escalation) {
    lines.push(
      '',
      'escalate to:',
      `  ${result.escalation.model} (${result.escalation.tier}) — ${result.escalation.trigger}`,
    );
  }

  lines.push('', 'why:', ...result.reasons.map((r) => `  - ${r}`));
  return { text: lines.join('\n'), exitCode: 0 };
}
