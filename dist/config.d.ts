import { type Effort, type ModelId, type Provider, type Tier } from './constants/models.js';
export declare const CONFIG_DIR = ".kodemux";
export declare const CONFIG_FILE = "config.json";
export declare const CONFIG_VERSION = 4;
export interface TierPolicy {
    model: ModelId;
    /** [base, boosted] effort; null = no effort directive (e.g. Haiku). */
    efforts: [Effort | null, Effort | null];
}
export interface RouterPolicy {
    /**
     * Which coding agent the directives are written for. Only changes the models
     * on the ladder and the directive syntax — thresholds, floors, escalation and
     * caps are provider-agnostic.
     */
    provider: Provider;
    /** Model + effort for each rung of the ladder. */
    tiers: Record<Tier, TierPolicy>;
    /**
     * Minimum complexity score to reach each tier above `simple`. A prompt scoring
     * below `standard` routes to `simple`.
     */
    thresholds: {
        standard: number;
        complex: number;
        frontier: number;
    };
    /** Minimum tier when any risk flag (security/production/critical) is present. */
    riskFloor: Tier;
    /** Escalate (recommend the next tier up) when confidence is below this. */
    escalateBelowConfidence: number;
    /**
     * Glob patterns for high-blast-radius paths. A change touching any of these
     * raises a `critical` risk flag and floors the tier — even if the prompt text
     * never mentions it.
     */
    criticalPaths: string[];
    /**
     * When the deterministic pass is unsure (confidence below
     * `escalateBelowConfidence`), consult a cheap AI judge (Haiku) using
     * whatever Anthropic credentials are already configured, before falling
     * back to the deterministic escalation cascade. On by default; failures
     * (no credentials, network, timeout) always fall back silently.
     */
    aiAssist: boolean;
}
export interface HookConfig {
    pre: {
        secretsScan: boolean;
        branchProtection: string[];
    };
    post: {
        format: boolean;
        lint: boolean;
        scopedTests: boolean;
    };
}
export interface KodemuxConfig {
    version: number;
    stack: string[];
    router: RouterPolicy;
    hooks: HookConfig;
}
/** Built-in router policy for a provider, derived from that provider's ladder. */
export declare function defaultRouterPolicy(provider?: Provider): RouterPolicy;
/** Build a default config for a freshly detected stack. */
export declare function defaultConfig(stack: string[], provider?: Provider): KodemuxConfig;
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
export declare function withProvider(policy: RouterPolicy, provider: Provider): RouterPolicy;
export declare function configPath(cwd: string): string;
/**
 * Load and normalize `.kodemux/config.json`. Missing fields fall back to
 * defaults, so a partial hand-edited config stays valid. Throws a readable
 * error if the file is present but not valid JSON.
 */
export declare function loadConfig(cwd: string): KodemuxConfig | null;
