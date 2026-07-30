/**
 * Config schema, defaults, and loader for `.kodemux/config.json`.
 *
 * The router is policy-driven: a capability ladder of tiers, complexity
 * thresholds that pick the tier, and a risk floor. Every knob is overridable.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_PROVIDER, PROVIDERS, TIER_SPECS_BY_PROVIDER, TIERS, } from './constants/models.js';
export const CONFIG_DIR = '.kodemux';
export const CONFIG_FILE = 'config.json';
export const CONFIG_VERSION = 4;
/** Built-in router policy for a provider, derived from that provider's ladder. */
export function defaultRouterPolicy(provider = DEFAULT_PROVIDER) {
    const specs = TIER_SPECS_BY_PROVIDER[provider];
    const tiers = {};
    for (const t of TIERS) {
        tiers[t] = { model: specs[t].model, efforts: [...specs[t].efforts] };
    }
    return {
        provider,
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
export function defaultConfig(stack, provider = DEFAULT_PROVIDER) {
    return {
        version: CONFIG_VERSION,
        stack,
        router: defaultRouterPolicy(provider),
        hooks: {
            pre: {
                secretsScan: true,
                branchProtection: ['main', 'master', 'production'],
            },
            post: { format: true, lint: true, scopedTests: true },
        },
    };
}
/**
 * Retarget a policy at a different provider, for a single invocation
 * (`kodemux route --provider codex`) without touching the persisted config.
 *
 * Only rungs still sitting on the *current* provider's built-in model are
 * swapped — a tier a developer deliberately pinned to some other model is left
 * alone, so `--provider` never silently discards a hand-written override.
 * Everything else (thresholds, floors, criticalPaths, aiAssist) is
 * provider-agnostic and carries over untouched.
 */
export function withProvider(policy, provider) {
    if (policy.provider === provider)
        return policy;
    const from = TIER_SPECS_BY_PROVIDER[policy.provider];
    const to = TIER_SPECS_BY_PROVIDER[provider];
    const tiers = {};
    for (const t of TIERS) {
        tiers[t] =
            policy.tiers[t].model === from[t].model
                ? { model: to[t].model, efforts: [...to[t].efforts] }
                : policy.tiers[t];
    }
    return { ...policy, provider, tiers };
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
    const pr = (parsed.router ?? {});
    // The provider selects which built-in ladder the tier defaults come from, so
    // it has to be resolved before the base config is built.
    const provider = PROVIDERS.includes(pr.provider)
        ? pr.provider
        : DEFAULT_PROVIDER;
    const base = defaultConfig(parsed.stack ?? [], provider);
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
            provider,
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