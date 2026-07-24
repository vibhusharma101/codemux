/**
 * `kodemux init` — detect the repo stack and scaffold `.kodemux/`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectStack } from '../detect.js';
import { CONFIG_DIR, configPath, defaultConfig, } from '../config.js';
/** Synthesized CLAUDE.md the agent can pick up in the consumer repo. */
function claudeTemplate(config) {
    const stack = config.stack.length ? config.stack.join(', ') : 'unknown';
    return `# Project routing (managed by kodemux)

Detected stack: ${stack}

Route tasks with \`kodemux route "<your prompt>"\` and follow the emitted
model / effort / mode directives. Guardrails run via \`kodemux scan\` and
\`kodemux guard\`. Edit \`.kodemux/config.json\` to override any routing row
or hook.
`;
}
/**
 * Scaffold `.kodemux/` at `cwd`. Idempotent unless `force` is set: an existing
 * config is left untouched and reported under `skipped`.
 */
export function init(cwd, opts = {}) {
    const created = [];
    const skipped = [];
    const stack = detectStack(cwd);
    const config = defaultConfig(stack);
    const dir = join(cwd, CONFIG_DIR);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
        created.push(CONFIG_DIR + '/');
    }
    const cfgPath = configPath(cwd);
    if (existsSync(cfgPath) && !opts.force) {
        skipped.push(`${CONFIG_DIR}/config.json (exists — use --force to overwrite)`);
    }
    else {
        writeFileSync(cfgPath, JSON.stringify(config, null, 2) + '\n', 'utf8');
        created.push(`${CONFIG_DIR}/config.json`);
    }
    const claudePath = join(dir, 'CLAUDE.md');
    if (existsSync(claudePath) && !opts.force) {
        skipped.push(`${CONFIG_DIR}/CLAUDE.md (exists — use --force to overwrite)`);
    }
    else {
        writeFileSync(claudePath, claudeTemplate(config), 'utf8');
        created.push(`${CONFIG_DIR}/CLAUDE.md`);
    }
    return { config, created, skipped };
}
//# sourceMappingURL=init.js.map