/**
 * Router — turns prompt analysis into a routing decision on the capability
 * ladder, with a confidence estimate and an escalation (cascade) recommendation.
 */
import { type Analysis, type RiskFlag, type Signals } from './classify.js';
import { type Effort, type Intent, type Mode, type ModelId, type Tier } from './constants/models.js';
import { type RouterPolicy } from './config.js';
export interface RouteTarget {
    model: ModelId;
    /** null when the chosen model takes no effort directive (Haiku). */
    effort: Effort | null;
    mode: Mode;
}
export interface Escalation {
    model: ModelId;
    tier: Tier;
    trigger: string;
}
/**
 * Optional input from the AI-assist judge (src/ai-judge.ts). The router only
 * ever raises complexity/risk from this — it can escalate a route, never
 * quietly downgrade one — so the deterministic floor is always the safety net.
 */
export interface AiHint {
    complexity: number;
    risks: RiskFlag[];
    rationale?: string;
}
export interface RouteResult {
    intent: Intent;
    complexity: number;
    tier: Tier;
    risks: RiskFlag[];
    target: RouteTarget;
    /**
     * Recommended number of parallel agents. 1 for single/plan/read-only modes;
     * 2+ only when the work is genuinely parallelizable (multi-agent mode).
     */
    parallelAgents: number;
    /** 0..1 — how sure the router is about this tier. */
    confidence: number;
    /** Cascade recommendation when confidence is low; null otherwise. */
    escalation: Escalation | null;
    /** True when an AiHint was applied (and actually contributed to the score). */
    aiAssisted: boolean;
    /** True when a developer-supplied cap (RouteCap) actually lowered the tier
     *  and/or effort below what complexity/risk alone would have picked. */
    capped: boolean;
    /** Agent-facing directives, e.g. `/model claude-opus-4-8`, `/effort xhigh`. */
    directives: string[];
    reasons: string[];
}
/**
 * Per-invocation ceiling a developer can set for a single prompt (e.g. the CLI's
 * `--max-tier` / `--max-effort` flags), without touching the persisted config.
 * The router still runs its full analysis — a cap only clamps the *result*
 * downward afterward, it never raises anything.
 */
export interface RouteCap {
    /** Never route above this tier, even if complexity/risk would call for one. */
    maxTier?: Tier;
    /** Clamp the chosen effort to at most this level on the global low→max scale. */
    maxEffort?: Effort;
}
/**
 * Build the ordered directive list. Omits `/effort` when the model has none,
 * and appends `/agents N` only when multi-agent mode recommends parallelism.
 */
export declare function directivesFor(target: RouteTarget, parallelAgents?: number): string[];
/**
 * Recommend how many agents to fan out in parallel. Only meaningful in
 * multi-agent mode; scales with independent workstreams (files, steps, scope)
 * and is capped so a plan doesn't spawn an unmanageable swarm.
 */
export declare function recommendParallelism(a: Analysis, mode: Mode, fileCount: number | undefined): number;
/**
 * Route a prompt to a tier on the capability ladder. Uses the config's router
 * policy when provided (so overrides apply), otherwise the built-in defaults.
 *
 * `aiHint` is the optional output of the AI-assist judge (src/ai-judge.ts).
 * When present, it can only *raise* complexity/risk — never lower them — so
 * the deterministic analysis remains the floor and this function stays a pure,
 * synchronous, fully-testable calculation regardless of how the hint was
 * obtained.
 *
 * `cap` is the opposite lever: an optional developer-supplied ceiling for this
 * one invocation (never persisted). It runs *after* the full analysis and only
 * clamps the outcome downward — it can lower the tier/effort the router would
 * otherwise have picked, but never raise it above what the analysis produced.
 */
export declare function route(prompt: string, config?: {
    router: RouterPolicy;
}, signals?: Signals, aiHint?: AiHint, cap?: RouteCap): RouteResult;
