/**
 * Central model / routing constants.
 *
 * kodemux routes on a **capability ladder** rather than a fixed intent→model
 * table. Every model string lives here so a provider rename is a one-line
 * change. Ordered cheapest/fastest → most capable/expensive.
 *
 * Two provider ladders ship in the box — the *rungs* are identical, only the
 * models behind them differ, so the whole router (thresholds, floors,
 * escalation, caps) is provider-agnostic:
 *
 * Anthropic / Claude Code (`claude`):
 *   - Haiku 4.5  — fastest & cheapest; simple, mechanical tasks. No `effort` control.
 *   - Sonnet 5   — balanced; near-Opus quality on everyday coding/features.
 *   - Opus 5     — flagship; highly autonomous, hard multi-file & long-horizon work.
 *   - Fable 5    — most capable widely-released model; the most demanding reasoning
 *                  and long-horizon agentic work (and the most expensive).
 *
 * OpenAI / Codex CLI (`codex`) — the GPT-5.6 three-tier family:
 *   - gpt-5.6-luna  — volume tier; clear, repeatable tasks (extraction, boilerplate).
 *   - gpt-5.6-terra — balanced tier; everyday development, review, tests.
 *   - gpt-5.6-sol   — flagship; complex architecture, multi-file refactors, audits.
 *                     Tops the ladder twice, separated from the rung below it by
 *                     reasoning effort (`xhigh` → `max`).
 */
/** Coding agents kodemux can emit directives for. */
export declare const PROVIDERS: readonly ["claude", "codex"];
export type Provider = (typeof PROVIDERS)[number];
/** Fallback provider when nothing is configured. */
export declare const DEFAULT_PROVIDER: Provider;
/** Canonical Anthropic model identifiers (aliases — never date-suffixed). */
export declare const MODELS: {
    readonly HAIKU_4_5: "claude-haiku-4-5";
    readonly SONNET_5: "claude-sonnet-5";
    readonly OPUS_5: "claude-opus-5";
    readonly FABLE_5: "claude-fable-5";
};
/**
 * Canonical OpenAI Codex model identifiers. `gpt-5.2` and `gpt-5.3-codex` are
 * deprecated in Codex for ChatGPT sign-in, so the ladder is built entirely
 * from the current GPT-5.6 family.
 */
export declare const CODEX_MODELS: {
    readonly LUNA: "gpt-5.6-luna";
    readonly TERRA: "gpt-5.6-terra";
    readonly SOL: "gpt-5.6-sol";
};
export type ClaudeModelId = (typeof MODELS)[keyof typeof MODELS];
export type CodexModelId = (typeof CODEX_MODELS)[keyof typeof CODEX_MODELS];
/** Any model kodemux can route to. Custom strings are allowed via config. */
export type ModelId = ClaudeModelId | CodexModelId | (string & {});
/**
 * Reasoning effort levels, cheapest → most expensive. This is the *shared*
 * scale kodemux reasons on; not every provider accepts every rung (see
 * `PROVIDER_EFFORTS`) — `ultra` is Codex-only today.
 */
export declare const EFFORTS: readonly ["low", "medium", "high", "xhigh", "max", "ultra"];
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
/** Anthropic ladder — the default. */
export declare const TIER_SPECS: Record<Tier, TierSpec>;
/**
 * OpenAI Codex ladder. Every GPT-5.6 tier takes a `model_reasoning_effort`
 * setting (unlike Haiku, which has no effort control), so `simple` is not null
 * here. `sol` sits on both top rungs, separated by effort.
 */
export declare const CODEX_TIER_SPECS: Record<Tier, TierSpec>;
/** The built-in ladder for each provider. */
export declare const TIER_SPECS_BY_PROVIDER: Record<Provider, Record<Tier, TierSpec>>;
/**
 * Effort levels each provider actually accepts. The router clamps its chosen
 * effort to this list, so a hand-edited config can't emit a directive the
 * downstream agent would reject (`ultra` is Codex-only; Claude tops out at
 * `max`).
 */
export declare const PROVIDER_EFFORTS: Record<Provider, readonly Effort[]>;
/** Clamp an effort to the highest level `provider` supports. */
export declare function clampEffortToProvider(effort: Effort | null, provider: Provider): Effort | null;
/** Numeric index of a tier on the ladder (0 = cheapest). */
export declare function tierIndex(tier: Tier): number;
