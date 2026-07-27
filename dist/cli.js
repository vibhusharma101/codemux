#!/usr/bin/env node
/**
 * kodemux CLI entry point.
 */
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { init } from './commands/init.js';
import { runRoute } from './commands/route.js';
import { runScan } from './commands/scan.js';
import { runGuard } from './commands/guard.js';
import { runPost } from './commands/post.js';
import { installHooks } from './commands/hooks-install.js';
import { userPromptSubmitHook, preToolUseHook } from './hook-adapters.js';
import { EFFORTS, TIERS } from './constants/models.js';
const require = createRequire(import.meta.url);
const pkg = require('../package.json');
const program = new Command();
program
    .name('kodemux')
    .description('Repo-native middleware & guardrail engine for AI coding tools')
    .version(pkg.version, '-v, --version');
program
    .command('init')
    .description('Detect the repo stack and scaffold .kodemux/')
    .option('-f, --force', 'overwrite an existing config', false)
    .action((opts) => {
    const result = init(process.cwd(), { force: opts.force });
    const stack = result.config.stack.length
        ? result.config.stack.join(', ')
        : 'none detected';
    console.log(`Detected stack: ${stack}`);
    for (const f of result.created)
        console.log(`  created  ${f}`);
    for (const f of result.skipped)
        console.log(`  skipped  ${f}`);
    console.log('\nEdit .kodemux/config.json to override routing or hooks.');
});
program
    .command('route')
    .description('Analyze a prompt (with auto git context) and emit routing directives')
    .argument('<prompt>', 'the task prompt to route')
    .option('--files <n>', 'override auto-detected file count')
    .option('--diff-lines <n>', 'override auto-detected diff size')
    .option('--base <ref>', 'diff against a base ref (e.g. main) instead of the working tree')
    .option('--no-git', 'disable automatic git context detection')
    .option('--no-ai', 'disable AI-assisted escalation for low-confidence routes')
    .option('--max-tier <tier>', `cap the routed tier at or below this for this prompt only (${TIERS.join('|')})`)
    .option('--max-effort <effort>', `cap the effort directive at or below this for this prompt only (${EFFORTS.join('|')})`)
    .option('--json', 'emit machine-readable JSON', false)
    .action(async (prompt, opts) => {
    const out = await runRoute(process.cwd(), prompt, opts);
    if (out.exitCode === 0)
        console.log(out.text);
    else
        console.error(out.text);
    process.exitCode = out.exitCode;
});
program
    .command('scan')
    .description('Pre-hook: scan changed files for secret-shaped strings')
    .option('--json', 'emit machine-readable JSON', false)
    .action((opts) => {
    const out = runScan(process.cwd(), opts);
    (out.exitCode === 0 ? console.log : console.error)(out.text);
    process.exitCode = out.exitCode;
});
program
    .command('guard')
    .description('Pre-hook: refuse direct edits on a protected branch')
    .action(() => {
    const out = runGuard(process.cwd());
    (out.exitCode === 0 ? console.log : console.error)(out.text);
    process.exitCode = out.exitCode;
});
program
    .command('post')
    .description('Post-hook: plan (or run) scoped format/lint/test for changed files')
    .option('--run', 'execute the plan instead of dry-run', false)
    .option('--json', 'emit machine-readable JSON (plan only)', false)
    .action((opts) => {
    const out = runPost(process.cwd(), opts);
    (out.exitCode === 0 ? console.log : console.error)(out.text);
    process.exitCode = out.exitCode;
});
const hooksCmd = program.command('hooks').description('Manage Claude Code hook registration');
hooksCmd
    .command('install')
    .description('Register kodemux hooks in .claude/settings.json (additive, idempotent)')
    .option('-g, --global', 'install into ~/.claude/settings.json instead of the project', false)
    .action((opts) => {
    const out = installHooks(process.cwd(), { global: opts.global });
    (out.exitCode === 0 ? console.log : console.error)(out.text);
    process.exitCode = out.exitCode;
});
/** Read all of stdin (Claude Code pipes the hook payload as JSON on stdin). */
async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin)
        chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}
program
    .command('hook')
    .description('Claude Code hook entrypoint: reads a JSON payload from stdin and dispatches it')
    .argument('<event>', 'user-prompt-submit | pre-tool-use')
    .action(async (event) => {
    const raw = await readStdin();
    let payload = {};
    try {
        payload = raw.trim() ? JSON.parse(raw) : {};
    }
    catch {
        payload = {};
    }
    let result;
    if (event === 'user-prompt-submit') {
        result = await userPromptSubmitHook(payload);
    }
    else if (event === 'pre-tool-use') {
        result = await preToolUseHook(payload);
    }
    else {
        console.error(`kodemux hook: unknown event '${event}' (expected user-prompt-submit | pre-tool-use)`);
        process.exitCode = 1;
        return;
    }
    if (result.stdout)
        console.log(result.stdout);
    if (result.stderr)
        console.error(result.stderr);
    process.exitCode = result.exitCode;
});
program.parseAsync(process.argv).catch((err) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`kodemux: ${msg}`);
    process.exitCode = 1;
});
//# sourceMappingURL=cli.js.map