/**
 * Central model / routing constants.
 *
 * Keep every model string in this one file so a provider rename is a one-line
 * change. The router matrix maps a classified task {@link Intent} to a concrete
 * {@link RouteTarget} (model + effort + mode).
 */

/** Canonical model identifiers. */
export const MODELS = {
  FABLE_5: 'claude-fable-5',
  OPUS_4_8: 'claude-opus-4-8',
  SONNET_5: 'claude-sonnet-5',
  HAIKU_4_5: 'claude-haiku-4-5',
} as const;

export type ModelId = (typeof MODELS)[keyof typeof MODELS];

/** Reasoning effort levels, cheapest → most expensive. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh'] as const;
export type Effort = (typeof EFFORTS)[number];

/** Execution modes emitted as directives to the downstream agent. */
export const MODES = ['single', 'plan', 'multi-agent', 'read-only'] as const;
export type Mode = (typeof MODES)[number];

/** Task intents the classifier can resolve a prompt to. */
export const INTENTS = [
  'architecture',
  'feature',
  'bugfix',
  'docs',
  'security',
] as const;
export type Intent = (typeof INTENTS)[number];

/** A concrete routing decision. */
export interface RouteTarget {
  model: ModelId;
  effort: Effort;
  mode: Mode;
}

/**
 * Default router matrix. Mirrors the table in PLAN.md §3. Every row is
 * overridable via `.codemux/config.json`.
 */
export const ROUTER_MATRIX: Record<Intent, RouteTarget> = {
  architecture: { model: MODELS.FABLE_5, effort: 'xhigh', mode: 'multi-agent' },
  feature: { model: MODELS.SONNET_5, effort: 'high', mode: 'plan' },
  bugfix: { model: MODELS.SONNET_5, effort: 'medium', mode: 'single' },
  docs: { model: MODELS.HAIKU_4_5, effort: 'low', mode: 'single' },
  security: { model: MODELS.FABLE_5, effort: 'high', mode: 'read-only' },
};

/** Fallback intent when the classifier cannot make a confident decision. */
export const DEFAULT_INTENT: Intent = 'feature';
