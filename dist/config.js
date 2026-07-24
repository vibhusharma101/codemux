/**
 * Config schema, defaults, and loader for `.kodemux/config.json`.
 *
 * The router is policy-driven: a capability ladder of tiers, complexity
 * thresholds that pick the tier, and a risk floor. Every knob is overridable.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TIER_SPECS, TIERS, } from './constants/models.js';
export const CONFIG_DIR = '.kodemux';
export const CONFIG_FILE = 'config.json';
export const CONFIG_VERSION = 3;
/** Built-in router policy, derived from the tier specs. */
export function defaultRouterPolicy() {
    const tiers = {};
    for (const t of TIERS) {
        tiers[t] = { model: TIER_SPECS[t].model, efforts: [...TIER_SPECS[t].efforts] };
    }
    return {
        tiers,
        thresholds: { standard: 2, complex: 5, frontier: 9 },
        riskFloor: 'complex',
        escalateBelowConfidence: 0.6,
        aiAssist: true,
        criticalPaths: [
            '**/auth/**',
            '**/migrations/**',
            'infra/**',
            '.env*',
            '**/secrets/**',
            '**/payment*/**',
            '**/billing/**',
            '**/*.tf',
        ],
    };
}
/** Build a default config for a freshly detected stack. */
export function defaultConfig(stack) {
    return {
        version: CONFIG_VERSION,
        stack,
        router: defaultRouterPolicy(),
        hooks: {
            pre: {
                secretsScan: true,
                branchProtection: ['main', 'master', 'production'],
            },
            post: { format: true, lint: true, scopedTests: true },
        },
    };
}
export function configPath(cwd) {
    return join(cwd, CONFIG_DIR, CONFIG_FILE);
}
/**
 * Load and normalize `.kodemux/config.json`. Missing fields fall back to
 * defaults, so a partial hand-edited config stays valid. Throws a readable
 * error if the file is present but not valid JSON.
 */
export function loadConfig(cwd) {
    const path = configPath(cwd);
    if (!existsSync(path))
        return null;
    let raw;
    try {
        raw = JSON.parse(readFileSync(path, 'utf8'));
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Invalid JSON in ${path}: ${msg}`);
    }
    const parsed = (raw ?? {});
    const base = defaultConfig(parsed.stack ?? []);
    const pr = (parsed.router ?? {});
    // Deep-merge each tier so a partial override (e.g. just `model`) keeps the
    // base `efforts` instead of dropping it — a shallow spread here would leave
    // `efforts` undefined and crash the router.
    const prTiers = (pr.tiers ?? {});
    const tiers = {};
    for (const t of TIERS) {
        tiers[t] = { ...base.router.tiers[t], ...(prTiers[t] ?? {}) };
    }
    return {
        version: parsed.version ?? base.version,
        stack: parsed.stack ?? base.stack,
        router: {
            tiers,
            thresholds: { ...base.router.thresholds, ...(pr.thresholds ?? {}) },
            riskFloor: pr.riskFloor ?? base.router.riskFloor,
            escalateBelowConfidence: pr.escalateBelowConfidence ?? base.router.escalateBelowConfidence,
            criticalPaths: pr.criticalPaths ?? base.router.criticalPaths,
            aiAssist: pr.aiAssist ?? base.router.aiAssist,
        },
        hooks: {
            pre: { ...base.hooks.pre, ...(parsed.hooks?.pre ?? {}) },
            post: { ...base.hooks.post, ...(parsed.hooks?.post ?? {}) },
        },
    };
}
//# sourceMappingURL=config.js.map