/**
 * Router — turns prompt analysis into a routing decision on the capability
 * ladder, with a confidence estimate and an escalation (cascade) recommendation.
 */
import { analyze } from './classify.js';
import { DEFAULT_PROVIDER, EFFORTS, TIERS, clampEffortToProvider, tierIndex, } from './constants/models.js';
import { defaultRouterPolicy } from './config.js';
import { matchesAny } from './glob.js';
/**
 * Intent-based tier floors. Real code work (features, fixes, refactors) starts
 * at `standard`; only docs/tests are allowed to route to the `simple` tier.
 * Structural design work floors higher.
 */
const INTENT_FLOOR = {
    bugfix: 'standard',
    feature: 'standard',
    refactor: 'standard',
    architecture: 'complex',
};
/**
 * Confidence assigned to a route after a successful AI-judge consultation —
 * high enough to sit above the escalation threshold (the ambiguity that
 * triggered the judge has been resolved), but short of certainty.
 */
const AI_ASSISTED_CONFIDENCE = 0.85;
function modeDirective(mode) {
    switch (mode) {
        case 'plan':
            return '/plan';
        case 'single':
            return '/mode single';
        case 'multi-agent':
            return '/mode multi-agent';
        case 'read-only':
            return '/mode read-only';
    }
}
/**
 * Build the ordered directive list for the target provider.
 *
 * Claude Code takes model, effort and mode as separate slash commands. The
 * Codex CLI's `/model` picker sets model *and* reasoning effort in one command,
 * has `/approvals` rather than modes, and has no subagent fan-out — so the
 * parallel and plan decisions are emitted as plain guidance there.
 */
export function directivesFor(target, parallelAgents = 1, provider = DEFAULT_PROVIDER) {
    if (provider === 'codex')
        return codexDirectives(target, parallelAgents);
    const dirs = [`/model ${target.model}`];
    if (target.effort)
        dirs.push(`/effort ${target.effort}`);
    dirs.push(modeDirective(target.mode));
    if (target.mode === 'multi-agent' && parallelAgents > 1) {
        dirs.push(`/agents ${parallelAgents}`);
    }
    return dirs;
}
function codexDirectives(target, parallelAgents) {
    const dirs = [`/model ${target.model}${target.effort ? ` ${target.effort}` : ''}`];
    switch (target.mode) {
        case 'read-only':
            dirs.push('/approvals read-only');
            break;
        case 'plan':
            dirs.push('plan first — outline the change and confirm before editing');
            break;
        case 'multi-agent':
            if (parallelAgents > 1) {
                dirs.push(`split across ${parallelAgents} parallel codex sessions (one per independent workstream)`);
            }
            break;
        case 'single':
            break;
    }
    return dirs;
}
/**
 * The exact `codex` command line for this decision. Codex reads reasoning
 * effort from config (`-c model_reasoning_effort=...`), and read-only work maps
 * onto its sandbox flag.
 */
function codexInvocation(target) {
    const parts = ['codex', '-m', target.model];
    if (target.effort)
        parts.push('-c', `model_reasoning_effort="${target.effort}"`);
    if (target.mode === 'read-only')
        parts.push('--sandbox', 'read-only');
    return parts.join(' ');
}
/**
 * Recommend how many agents to fan out in parallel. Only meaningful in
 * multi-agent mode; scales with independent workstreams (files, steps, scope)
 * and is capped so a plan doesn't spawn an unmanageable swarm.
 */
export function recommendParallelism(a, mode, fileCount) {
    if (mode !== 'multi-agent')
        return 1;
    let n = 2;
    if (fileCount !== undefined) {
        if (fileCount >= 40)
            n = 4;
        else if (fileCount >= 20)
            n = 3;
    }
    // each explicit extra step is an independent workstream (capped)
    n += Math.min(2, Math.max(0, a.steps - 1));
    if (a.scopeWide)
        n += 1;
    return Math.max(2, Math.min(6, n));
}
/** Pick the base tier from the complexity score. */
function tierFromComplexity(complexity, p) {
    if (complexity >= p.thresholds.frontier)
        return 'frontier';
    if (complexity >= p.thresholds.complex)
        return 'complex';
    if (complexity >= p.thresholds.standard)
        return 'standard';
    return 'simple';
}
function maxTier(a, b) {
    return tierIndex(a) >= tierIndex(b) ? a : b;
}
/** Distance from the complexity score to the nearest threshold boundary. */
function boundaryDistance(complexity, p) {
    const bounds = [p.thresholds.standard, p.thresholds.complex, p.thresholds.frontier];
    return Math.min(...bounds.map((b) => Math.abs(complexity - b)));
}
/** Estimate confidence from evidence strength, conflict, and boundary proximity. */
function estimateConfidence(a, complexity, p) {
    let conf = 0.5;
    conf += Math.min(0.35, 0.07 * a.reasons.length);
    // conflicting signals (both "trivial" and "hard" language) → less sure
    if (a.complexityHits.length && a.simplicityHits.length)
        conf -= 0.2;
    // clearly-simple or clearly-hard prompts are unambiguous → more sure
    if (a.simplicityHits.length && !a.complexityHits.length)
        conf += 0.12;
    if (a.complexityHits.length >= 3 && !a.simplicityHits.length)
        conf += 0.12;
    // sitting right on a tier boundary → less sure which side to pick
    if (boundaryDistance(complexity, p) <= 1)
        conf -= 0.15;
    // no evidence at all → default guess
    if (a.complexity === 0 && a.reasons.length === 0)
        conf = 0.25;
    return Math.max(0.05, Math.min(0.97, Number(conf.toFixed(2))));
}
function chooseMode(a, tier) {
    const idx = tierIndex(tier);
    // Reviews / audits are read-only regardless of tier.
    if (a.intent === 'security' && a.intentHits.some((h) => /audit|review|assess/.test(h))) {
        return 'read-only';
    }
    if (idx >= tierIndex('complex') && (a.scopeWide || a.multiStep))
        return 'multi-agent';
    if (idx >= tierIndex('standard') &&
        (a.multiStep || a.intent === 'feature' || a.intent === 'refactor' || a.intent === 'architecture')) {
        return 'plan';
    }
    return 'single';
}
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
export function route(prompt, config, signals = {}, aiHint, cap) {
    const p = config?.router ?? defaultRouterPolicy();
    const provider = p.provider ?? DEFAULT_PROVIDER;
    const a = analyze(prompt, signals);
    // Merge prompt-derived risks with critical-path risk from the actual diff,
    // then with anything the AI judge flagged.
    const risks = [...a.risks];
    const criticalHits = signals.paths && p.criticalPaths?.length
        ? signals.paths.filter((path) => matchesAny(path, p.criticalPaths))
        : [];
    if (criticalHits.length && !risks.includes('critical'))
        risks.push('critical');
    for (const r of aiHint?.risks ?? []) {
        if (!risks.includes(r))
            risks.push(r);
    }
    // The AI hint can only raise the complexity score, never lower it.
    const complexity = aiHint ? Math.max(a.complexity, aiHint.complexity) : a.complexity;
    const aiAssisted = Boolean(aiHint);
    // Base tier from complexity, then apply intent + risk floors.
    let tier = tierFromComplexity(complexity, p);
    const floor = INTENT_FLOOR[a.intent];
    if (floor)
        tier = maxTier(tier, floor);
    if (risks.length)
        tier = maxTier(tier, p.riskFloor);
    // Developer cap (--max-tier): clamps downward only, applied after the full
    // analysis so the "why" always reflects what the router actually wanted.
    const uncappedTier = tier;
    let tierCapped = false;
    if (cap?.maxTier && tierIndex(cap.maxTier) < tierIndex(tier)) {
        tier = cap.maxTier;
        tierCapped = true;
    }
    const spec = p.tiers[tier];
    // Boosted effort at the top of a band or when risk is present. `efforts`
    // falls back defensively so a hand-built policy missing the field can't crash.
    const efforts = spec.efforts ?? [null, null];
    const upperBand = complexity >= (p.thresholds.frontier + p.thresholds.complex) / 2;
    const boost = risks.length > 0 || upperBand || (a.multiStep && tierIndex(tier) >= tierIndex('complex'));
    let effort = efforts[boost ? 1 : 0] ?? efforts[0] ?? null;
    // Developer cap (--max-effort): same downward-only clamp, on the global
    // low→max effort scale rather than the tier's own [base, boosted] pair.
    let effortCapped = false;
    if (effort && cap?.maxEffort && EFFORTS.indexOf(cap.maxEffort) < EFFORTS.indexOf(effort)) {
        effort = cap.maxEffort;
        effortCapped = true;
    }
    // Never emit an effort the target agent doesn't accept (e.g. `ultra` is
    // Codex-only) — a hand-edited config could otherwise produce a dead directive.
    effort = clampEffortToProvider(effort, provider);
    const mode = chooseMode(a, tier);
    const target = { model: spec.model, effort, mode };
    const parallelAgents = recommendParallelism(a, mode, signals.fileCount);
    // A successful AI consultation resolves the ambiguity that triggered it —
    // treat the merged decision as confident rather than re-scoring the
    // (now-stale) text-only signal.
    const confidence = aiAssisted ? AI_ASSISTED_CONFIDENCE : estimateConfidence(a, complexity, p);
    // Escalation (cascade): recommend the next tier up when unsure — but never
    // recommend past a developer-supplied cap; that would defeat the point of it.
    let escalation = null;
    let escalationBlockedByCap = false;
    const idx = tierIndex(tier);
    if (idx < TIERS.length - 1 && confidence < p.escalateBelowConfidence) {
        const next = TIERS[idx + 1];
        if (cap?.maxTier && tierIndex(next) > tierIndex(cap.maxTier)) {
            escalationBlockedByCap = true;
        }
        else {
            const nextEfforts = p.tiers[next].efforts ?? [null, null];
            escalation = {
                model: p.tiers[next].model,
                tier: next,
                effort: clampEffortToProvider(nextEfforts[1] ?? nextEfforts[0] ?? null, provider),
                trigger: 'if the agent stalls, reports low confidence, or the change proves larger than estimated',
            };
        }
    }
    const reasons = [...a.reasons];
    if (criticalHits.length) {
        reasons.push(`critical path touched (${criticalHits.slice(0, 3).join(', ')}) → +risk`);
    }
    if (aiHint) {
        const raised = aiHint.complexity > a.complexity ? ` (raised from ${a.complexity})` : '';
        reasons.push(`ai-assist (haiku): complexity ${aiHint.complexity}${raised}${aiHint.rationale ? ` — ${aiHint.rationale}` : ''}`);
    }
    reasons.unshift(`complexity ${complexity} + ${risks.length ? `risk[${risks.join(',')}] ` : ''}intent ${a.intent} → ${tier} tier`);
    if (tierCapped) {
        reasons.push(`developer cap: router would pick ${uncappedTier} tier, capped to ${tier} (--max-tier ${cap.maxTier})`);
    }
    if (effortCapped) {
        reasons.push(`developer cap: effort capped to ${effort} (--max-effort ${cap.maxEffort})`);
    }
    if (escalationBlockedByCap) {
        reasons.push(`confidence is low but escalation is blocked by --max-tier ${cap.maxTier} — review manually or raise the cap`);
    }
    if (mode === 'multi-agent') {
        reasons.push(`parallelizable work → fan out to ${parallelAgents} agents`);
    }
    return {
        intent: a.intent,
        complexity,
        provider,
        tier,
        risks,
        target,
        parallelAgents,
        confidence,
        escalation,
        aiAssisted,
        capped: tierCapped || effortCapped,
        directives: directivesFor(target, parallelAgents, provider),
        invocation: provider === 'codex' ? codexInvocation(target) : null,
        reasons,
    };
}
//# sourceMappingURL=router.js.map