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
export const MODELS = {
    HAIKU_4_5: 'claude-haiku-4-5',
    SONNET_5: 'claude-sonnet-5',
    OPUS_4_8: 'claude-opus-4-8',
    FABLE_5: 'claude-fable-5',
};
/** Reasoning effort levels, cheapest → most expensive. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];
/** Execution modes emitted as directives to the downstream agent. */
export const MODES = ['single', 'plan', 'multi-agent', 'read-only'];
/** Task intents the classifier resolves a prompt to (drives mode + tier floors). */
export const INTENTS = [
    'docs',
    'test',
    'bugfix',
    'feature',
    'refactor',
    'architecture',
    'security',
];
/** Fallback intent when nothing clearly matches. */
export const DEFAULT_INTENT = 'feature';
/**
 * Capability ladder. The router picks the cheapest tier that can handle the
 * estimated complexity, then escalates on low confidence.
 */
export const TIERS = ['simple', 'standard', 'complex', 'frontier'];
export const TIER_SPECS = {
    simple: {
        model: MODELS.HAIKU_4_5,
        efforts: [null, null],
        blurb: 'mechanical, low-risk edits',
    },
    standard: {
        model: MODELS.SONNET_5,
        efforts: ['medium', 'high'],
        blurb: 'everyday features & fixes',
    },
    complex: {
        model: MODELS.OPUS_4_8,
        efforts: ['high', 'xhigh'],
        blurb: 'hard, multi-file, autonomous work',
    },
    frontier: {
        model: MODELS.FABLE_5,
        efforts: ['xhigh', 'max'],
        blurb: 'the most demanding reasoning & long-horizon work',
    },
};
/** Numeric index of a tier on the ladder (0 = cheapest). */
export function tierIndex(tier) {
    return TIERS.indexOf(tier);
}
//# sourceMappingURL=models.js.map