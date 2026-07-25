/**
 * `kodemux hooks install` — registers kodemux's Claude Code hooks in
 * `.claude/settings.json`. Additive and idempotent: merges into whatever
 * hooks already exist (never overwrites another tool's entries), backs up the
 * file before writing, and running it twice does not duplicate entries.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
/**
 * Absolute, PATH-independent invocation of this CLI's `dist/cli.js` — so the
 * registered hook keeps working whether or not `kodemux` is on PATH (only
 * requirement: don't move/delete this cloned folder, same constraint as
 * `npm link`).
 */
function resolveSelfInvocation() {
    const cliPath = fileURLToPath(new URL('../cli.js', import.meta.url));
    return `"${process.execPath}" "${cliPath}"`;
}
function settingsPath(cwd, opts) {
    const dir = opts.global ? join(homedir(), '.claude') : join(cwd, '.claude');
    return join(dir, 'settings.json');
}
/** Append a hook command to a group array unless an identical command is already present. */
function upsertGroup(groups, matcher, command) {
    const list = groups ? [...groups] : [];
    const alreadyPresent = list.some((g) => g.hooks.some((h) => h.command === command));
    if (alreadyPresent)
        return list;
    list.push({ ...(matcher ? { matcher } : {}), hooks: [{ type: 'command', command }] });
    return list;
}
export function installHooks(cwd, opts = {}) {
    const path = settingsPath(cwd, opts);
    const dir = dirname(path);
    if (!existsSync(dir))
        mkdirSync(dir, { recursive: true });
    let settings = {};
    if (existsSync(path)) {
        try {
            settings = JSON.parse(readFileSync(path, 'utf8'));
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            return {
                text: `kodemux hooks install: ${path} exists but is not valid JSON (${msg}). Fix it manually first — nothing was changed.`,
                exitCode: 1,
            };
        }
        writeFileSync(`${path}.bak`, readFileSync(path, 'utf8'), 'utf8');
    }
    const invoke = resolveSelfInvocation();
    const promptCmd = `${invoke} hook user-prompt-submit`;
    const preToolCmd = `${invoke} hook pre-tool-use`;
    settings.hooks ??= {};
    const before = JSON.stringify(settings.hooks);
    settings.hooks.UserPromptSubmit = upsertGroup(settings.hooks.UserPromptSubmit, undefined, promptCmd);
    settings.hooks.PreToolUse = upsertGroup(settings.hooks.PreToolUse, 'Bash', preToolCmd);
    const changed = before !== JSON.stringify(settings.hooks);
    writeFileSync(path, JSON.stringify(settings, null, 2) + '\n', 'utf8');
    const lines = [
        changed
            ? `kodemux hooks install: registered in ${path}`
            : `kodemux hooks install: already registered in ${path} (no changes)`,
        '  UserPromptSubmit -> routing recommendation injected as context (never blocks)',
        '  PreToolUse (Bash) -> blocks `git commit` on a protected branch or with secrets in the diff',
    ];
    if (existsSync(`${path}.bak`))
        lines.push(`  backup: ${path}.bak`);
    return { text: lines.join('\n'), exitCode: 0 };
}
//# sourceMappingURL=hooks-install.js.map