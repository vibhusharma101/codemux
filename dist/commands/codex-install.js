/**
 * `kodemux codex install` — wire kodemux into the Codex CLI.
 *
 * Codex has no prompt-submit hook to register (that's the Claude Code
 * integration in `hooks-install.ts`), so the integration point is `AGENTS.md`:
 * the file Codex reads into context at the start of every session. We append a
 * marker-delimited block telling the agent to run `kodemux route` before
 * non-trivial work and `kodemux guard`/`kodemux scan` before committing.
 *
 * Advisory rather than enforced — Codex is following an instruction here, not
 * being blocked by a hook. Same additive/idempotent contract as the Claude Code
 * installer: existing content is preserved, a backup is written, and re-running
 * rewrites the block in place instead of duplicating it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
export const BEGIN_MARKER = '<!-- BEGIN kodemux -->';
export const END_MARKER = '<!-- END kodemux -->';
/** The managed block. Kept verbatim so re-running detects "no changes". */
export function kodemuxBlock() {
    return [
        BEGIN_MARKER,
        '## kodemux routing & guardrails',
        '',
        'Before starting any non-trivial task, run:',
        '',
        '```sh',
        'kodemux route "<the task>" --provider codex',
        '```',
        '',
        'It reads the real `git diff` and returns a model / reasoning-effort / mode',
        'recommendation with its reasoning. Treat it as advice: switch with the',
        '`/model` line it prints when you agree, and say so when you disagree.',
        '',
        'Before every commit, run both guardrails and stop if either fails:',
        '',
        '```sh',
        'kodemux guard   # refuses commits on a protected branch',
        'kodemux scan    # refuses commits containing secret-shaped strings',
        '```',
        END_MARKER,
    ].join('\n');
}
function targetPath(cwd, opts) {
    return opts.global ? join(homedir(), '.codex', 'AGENTS.md') : join(cwd, 'AGENTS.md');
}
/**
 * Replace an existing kodemux block, or append one. Returns null when the file
 * already contains exactly this block (nothing to do).
 */
export function upsertBlock(existing, block) {
    const start = existing.indexOf(BEGIN_MARKER);
    const end = existing.indexOf(END_MARKER);
    if (start !== -1 && end !== -1 && end > start) {
        const before = existing.slice(0, start);
        const after = existing.slice(end + END_MARKER.length);
        const next = `${before}${block}${after}`;
        return next === existing ? null : next;
    }
    const separator = existing.length === 0 ? '' : existing.endsWith('\n') ? '\n' : '\n\n';
    return `${existing}${separator}${block}\n`;
}
export function installCodex(cwd, opts = {}) {
    const path = targetPath(cwd, opts);
    const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
    const next = upsertBlock(existing, kodemuxBlock());
    if (next === null) {
        return { text: `kodemux codex install: already up to date in ${path}`, exitCode: 0 };
    }
    const dir = dirname(path);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    if (existing)
        writeFileSync(`${path}.bak`, existing, 'utf8');
    writeFileSync(path, next, 'utf8');
    const lines = [
        existing
            ? `kodemux codex install: updated the kodemux block in ${path}`
            : `kodemux codex install: created ${path}`,
        '  Codex will read this at the start of every session in this directory.',
        '  routing -> `kodemux route "<task>" --provider codex` (advisory)',
        '  commits -> `kodemux guard` + `kodemux scan` before `git commit`',
    ];
    if (existing)
        lines.push(`  backup: ${path}.bak`);
    return { text: lines.join('\n'), exitCode: 0 };
}
//# sourceMappingURL=codex-install.js.map