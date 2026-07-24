import { type Effort, type ModelId, type Tier } from './constants/models.js';
export declare const CONFIG_DIR = ".kodemux";
export declare const CONFIG_FILE = "config.json";
export declare const CONFIG_VERSION = 3;
export interface TierPolicy {
    model: ModelId;
    /** [base, boosted] effort; null = no effort directive (e.g. Haiku). */
    efforts: [Effort | null, Effort | null];
}
export interface RouterPolicy {
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
/** Built-in router policy, derived from the tier specs. */
export declare function defaultRouterPolicy(): RouterPolicy;
/** Build a default config for a freshly detected stack. */
export declare function defaultConfig(stack: string[]): KodemuxConfig;
export declare function configPath(cwd: string): string;
/**
 * Load and normalize `.kodemux/config.json`. Missing fields fall back to
 * defaults, so a partial hand-edited config stays valid. Throws a readable
 * error if the file is present but not valid JSON.
 */
export declare function loadConfig(cwd: string): KodemuxConfig | null;
