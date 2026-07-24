/**
 * `kodemux post` — post-hook runner. Plans (and optionally runs) scoped
 * formatters, linters, and tests for the changed files.
 */
import { execSync } from 'node:child_process';
import { changedFiles } from '../git.js';
import { loadConfig, defaultConfig } from '../config.js';
import { planPost } from '../hooks.js';
/**
 * Shell metacharacters that could turn an interpolated filename into a second
 * command. Tool binaries (npm/prettier/…) are often `.cmd` shims on Windows, so
 * we keep the shell for resolution and instead refuse to execute steps whose
 * file paths contain these characters. git-reported paths never contain them.
 */
const SHELL_UNSAFE = /[;&|`$<>(){}\n\r'"]/;
export function stepIsShellSafe(step) {
    return !step.files.some((f) => SHELL_UNSAFE.test(f));
}
/**
 * Pure planning + optional execution. In plan mode (default) this never shells
 * out, so it is safe and deterministic in tests.
 */
export function runPost(cwd, opts = {}) {
    const config = loadConfig(cwd) ?? defaultConfig([]);
    const files = opts.files ?? changedFiles(cwd).map((f) => f.path);
    const steps = planPost(files, config);
    if (opts.json && !opts.run) {
        return { text: JSON.stringify({ steps }, null, 2), exitCode: 0, steps };
    }
    if (steps.length === 0) {
        return {
            text: 'kodemux post: no formatter/lint/test steps for the changed files.',
            exitCode: 0,
            steps,
        };
    }
    if (!opts.run) {
        const lines = [
            `kodemux post: ${steps.length} step(s) planned (dry-run — pass --run to execute):`,
            ...steps.map((s) => `  [${s.kind}] ${s.command}`),
        ];
        return { text: lines.join('\n'), exitCode: 0, steps };
    }
    // Execution mode: run each step, continue on failure, report a summary.
    const results = [];
    let failed = 0;
    for (const step of steps) {
        if (!stepIsShellSafe(step)) {
            failed++;
            results.push(`  ✗ [${step.kind}] ${step.command} — skipped: a changed path contains shell-unsafe characters; run this tool manually`);
            continue;
        }
        try {
            execSync(step.command, { cwd, stdio: 'pipe' });
            results.push(`  ✓ [${step.kind}] ${step.command}`);
        }
        catch (err) {
            failed++;
            const msg = err instanceof Error ? err.message.split('\n')[0] : String(err);
            results.push(`  ✗ [${step.kind}] ${step.command} — ${msg}`);
        }
    }
    const header = failed === 0
        ? `kodemux post: ${steps.length} step(s) passed.`
        : `kodemux post: ${failed}/${steps.length} step(s) failed.`;
    return { text: [header, ...results].join('\n'), exitCode: failed ? 1 : 0, steps };
}
//# sourceMappingURL=post.js.map