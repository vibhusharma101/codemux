/**
 * `codemux post` — post-hook runner. Plans (and optionally runs) scoped
 * formatters, linters, and tests for the changed files.
 */
import { execSync } from 'node:child_process';
import { changedFiles } from '../git.js';
import { loadConfig, defaultConfig } from '../config.js';
import { planPost, type PostStep } from '../hooks.js';

export interface PostOptions {
  /** Repo-relative changed file paths; defaults to git-changed files. */
  files?: string[];
  /** Actually execute the plan (default is dry-run / plan only). */
  run?: boolean;
  json?: boolean;
}

export interface PostOutput {
  text: string;
  exitCode: number;
  steps: PostStep[];
}

/**
 * Pure planning + optional execution. In plan mode (default) this never shells
 * out, so it is safe and deterministic in tests.
 */
export function runPost(cwd: string, opts: PostOptions = {}): PostOutput {
  const config = loadConfig(cwd) ?? defaultConfig([]);
  const files =
    opts.files ?? changedFiles(cwd).map((f) => f.path);
  const steps = planPost(files, config);

  if (opts.json && !opts.run) {
    return { text: JSON.stringify({ steps }, null, 2), exitCode: 0, steps };
  }

  if (steps.length === 0) {
    return {
      text: 'codemux post: no formatter/lint/test steps for the changed files.',
      exitCode: 0,
      steps,
    };
  }

  if (!opts.run) {
    const lines = [
      `codemux post: ${steps.length} step(s) planned (dry-run — pass --run to execute):`,
      ...steps.map((s) => `  [${s.kind}] ${s.command}`),
    ];
    return { text: lines.join('\n'), exitCode: 0, steps };
  }

  // Execution mode: run each step, continue on failure, report a summary.
  const results: string[] = [];
  let failed = 0;
  for (const step of steps) {
    try {
      execSync(step.command, { cwd, stdio: 'pipe' });
      results.push(`  ✓ [${step.kind}] ${step.command}`);
    } catch (err) {
      failed++;
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
      results.push(`  ✗ [${step.kind}] ${step.command} — ${msg}`);
    }
  }
  const header =
    failed === 0
      ? `codemux post: ${steps.length} step(s) passed.`
      : `codemux post: ${failed}/${steps.length} step(s) failed.`;
  return { text: [header, ...results].join('\n'), exitCode: failed ? 1 : 0, steps };
}
