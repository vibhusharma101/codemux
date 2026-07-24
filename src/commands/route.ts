/**
 * `codemux route "<prompt>"` — analyze a prompt and emit routing directives.
 */
import { loadConfig } from '../config.js';
import { route } from '../router.js';
import type { Signals } from '../classify.js';

export interface RouteCommandOptions {
  files?: string;
  diffLines?: string;
  json?: boolean;
}

export interface RouteCommandOutput {
  text: string;
  exitCode: number;
}

/**
 * Pure command core: takes cwd + prompt + options, returns text to print and an
 * exit code. Side-effect-free (no console) so it is directly testable.
 */
export function runRoute(
  cwd: string,
  prompt: string,
  opts: RouteCommandOptions = {},
): RouteCommandOutput {
  if (!prompt || !prompt.trim()) {
    return { text: 'codemux route: a prompt is required', exitCode: 1 };
  }

  const config = loadConfig(cwd) ?? undefined;

  const signals: Signals = {};
  if (opts.files !== undefined) signals.fileCount = Number(opts.files);
  if (opts.diffLines !== undefined) signals.diffLines = Number(opts.diffLines);

  const result = route(prompt, config, signals);

  if (opts.json) {
    return { text: JSON.stringify(result, null, 2), exitCode: 0 };
  }

  const effort = result.target.effort ?? 'n/a (model has no effort control)';
  const lines = [
    `intent      ${result.intent}`,
    `complexity  ${result.complexity}/14`,
    `tier        ${result.tier}${result.risks.length ? `  [risk: ${result.risks.join(', ')}]` : ''}`,
    `confidence  ${result.confidence}`,
    '',
    `model       ${result.target.model}`,
    `effort      ${effort}`,
    `mode        ${result.target.mode}${result.target.mode === 'multi-agent' ? `  (${result.parallelAgents} agents in parallel)` : ''}`,
    '',
    'directives:',
    ...result.directives.map((d) => `  ${d}`),
  ];

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
