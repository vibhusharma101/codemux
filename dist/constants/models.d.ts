/**
 * Central model / routing constants.
 *
 * kodemux routes on a **capability ladder** rather than a fixed intent→model
 * table. Every model string lives here so a provider rename is a one-line
 * change. Ordered cheapest/fastest → most capable/expensive.
 *
 * Model positioning (Anthropic, current lineup):
 *   - Haiku 4.5  — fastest & cheapest; simple, mechanical tasks. No `effort` control.
 *   - Sonnet 5   — balanced; near-Opus quality on everyday coding/features.
 *   - Opus 4.8   — flagship; highly autonomous, hard multi-file & long-horizon work.
 *   - Fable 5    — most capable widely-released model; the most demanding reasoning
 *                  and long-horizon agentic work (and the most expensive).
 */
/** Canonical model identifiers (aliases — never date-suffixed). */
export declare const MODELS: {
    readonly HAIKU_4_5: "claude-haiku-4-5";
    readonly SONNET_5: "claude-sonnet-5";
    readonly OPUS_4_8: "claude-opus-4-8";
    readonly FABLE_5: "claude-fable-5";
};
export type ModelId = (typeof MODELS)[keyof typeof MODELS];
/** Reasoning effort levels, cheapest → most expensive. */
export declare const EFFORTS: readonly ["low", "medium", "high", "xhigh", "max"];
export type Effort = (typeof EFFORTS)[number];
/** Execution modes emitted as directives to the downstream agent. */
export declare const MODES: readonly ["single", "plan", "multi-agent", "read-only"];
export type Mode = (typeof MODES)[number];
/** Task intents the classifier resolves a prompt to (drives mode + tier floors). */
export declare const INTENTS: readonly ["docs", "test", "bugfix", "feature", "refactor", "architecture", "security"];
export type Intent = (typeof INTENTS)[number];
/** Fallback intent when nothing clearly matches. */
export declare const DEFAULT_INTENT: Intent;
/**
 * Capability ladder. The router picks the cheapest tier that can handle the
 * estimated complexity, then escalates on low confidence.
 */
export declare const TIERS: readonly ["simple", "standard", "complex", "frontier"];
export type Tier = (typeof TIERS)[number];
export interface TierSpec {
    model: ModelId;
    /**
     * [base, boosted] effort. `null` means the model takes no effort directive
     * (Haiku 4.5 does not support the `effort` parameter). Boosted effort is used
     * at the top of a tier's complexity band or when a risk flag is present.
     */
    efforts: [Effort | null, Effort | null];
    blurb: string;
}
export declare const TIER_SPECS: Record<Tier, TierSpec>;
/** Numeric index of a tier on the ladder (0 = cheapest). */
export declare function tierIndex(tier: Tier): number;
