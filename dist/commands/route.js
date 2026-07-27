/**
 * `kodemux route "<prompt>"` — analyze a prompt and emit routing directives.
 *
 * Repo context (files changed, diff size, critical-path hits) is read
 * automatically from git; `--files` / `--diff-lines` override the auto-detected
 * counts, and `--no-git` disables detection entirely.
 *
 * When the deterministic pass is unsure, an optional AI-assist step (on by
 * default) consults a cheap Haiku judge — reusing whatever Anthropic
 * credentials are already configured — before falling back to the plain
 * escalation cascade. `--no-ai` disables this step.
 *
 * `--max-tier` / `--max-effort` let a developer cap the routed tier/effort
 * for this one prompt without editing `.kodemux/config.json` — the router
 * still runs its full analysis, the cap only clamps the result downward.
 */
import { loadConfig } from '../config.js';
import { route } from '../router.js';
import { repoContext } from '../git.js';
import { judgeComplexity } from '../ai-judge.js';
import { EFFORTS, TIERS } from '../constants/models.js';
/**
 * Core: takes cwd + prompt + options, returns text to print and an exit code.
 * Side effects are reading git state (skippable via `--no-git`) and, only when
 * confidence is low, one AI-assist call (skippable via `--no-ai`) — both fail
 * safe and never throw.
 */
export async function runRoute(cwd, prompt, opts = {}, deps = {}) {
    if (!prompt || !prompt.trim()) {
        return { text: 'kodemux route: a prompt is required', exitCode: 1 };
    }
    let cap;
    if (opts.maxTier !== undefined) {
        if (!TIERS.includes(opts.maxTier)) {
            return {
                text: `kodemux route: --max-tier must be one of ${TIERS.join(', ')}`,
                exitCode: 1,
            };
        }
        cap = { ...cap, maxTier: opts.maxTier };
    }
    if (opts.maxEffort !== undefined) {
        if (!EFFORTS.includes(opts.maxEffort)) {
            return {
                text: `kodemux route: --max-effort must be one of ${EFFORTS.join(', ')}`,
                exitCode: 1,
            };
        }
        cap = { ...cap, maxEffort: opts.maxEffort };
    }
    const config = loadConfig(cwd) ?? undefined;
    const useGit = opts.git !== false;
    const ctx = useGit ? repoContext(cwd, opts.base) : null;
    const signals = {};
    if (opts.files !== undefined)
        signals.fileCount = Number(opts.files);
    else if (ctx && ctx.fileCount > 0)
        signals.fileCount = ctx.fileCount;
    if (opts.diffLines !== undefined)
        signals.diffLines = Number(opts.diffLines);
    else if (ctx && ctx.diffLines > 0)
        signals.diffLines = ctx.diffLines;
    if (ctx && ctx.paths.length)
        signals.paths = ctx.paths;
    let result = route(prompt, config, signals, undefined, cap);
    let judgeOutcome = null;
    const aiEnabled = opts.ai !== false && (config?.router.aiAssist ?? true);
    const threshold = config?.router.escalateBelowConfidence ?? 0.6;
    if (aiEnabled && result.confidence < threshold) {
        const judge = deps.judge ?? judgeComplexity;
        judgeOutcome = await judge(prompt, signals);
        if (judgeOutcome.ok) {
            result = route(prompt, config, signals, {
                complexity: judgeOutcome.result.complexity,
                risks: judgeOutcome.result.risks,
                rationale: judgeOutcome.result.rationale,
            }, cap);
        }
    }
    if (opts.json) {
        const detected = ctx
            ? { fileCount: ctx.fileCount, diffLines: ctx.diffLines, paths: ctx.paths, base: opts.base ?? null }
            : null;
        const aiAssist = judgeOutcome
            ? judgeOutcome.ok
                ? { attempted: true, applied: true, ...judgeOutcome.result }
                : { attempted: true, applied: false, reason: judgeOutcome.reason }
            : { attempted: false, applied: false };
        return { text: JSON.stringify({ ...result, detected, aiAssist }, null, 2), exitCode: 0 };
    }
    const effort = result.target.effort ?? 'n/a (model has no effort control)';
    const lines = [
        `intent      ${result.intent}`,
        `complexity  ${result.complexity}/14`,
        `tier        ${result.tier}${result.risks.length ? `  [risk: ${result.risks.join(', ')}]` : ''}${result.capped ? '  (capped — see "why")' : ''}`,
        `confidence  ${result.confidence}${result.aiAssisted ? '  (ai-assisted)' : ''}`,
    ];
    if (ctx && ctx.paths.length) {
        const where = opts.base ? `git vs ${opts.base}` : 'git working tree';
        lines.push(`context     ${ctx.fileCount} changed file(s), ~${ctx.diffLines} diff lines (${where})`);
    }
    if (judgeOutcome && !judgeOutcome.ok) {
        lines.push(`ai-assist   skipped (${judgeOutcome.reason})`);
    }
    lines.push('', `model       ${result.target.model}`, `effort      ${effort}`, `mode        ${result.target.mode}`, `agents      ${result.parallelAgents}${result.target.mode === 'multi-agent' ? '  (parallelize — independent workstreams)' : '  (single agent — do not parallelize)'}`, '', 'directives:', ...result.directives.map((d) => `  ${d}`));
    if (result.escalation) {
        lines.push('', 'escalate to:', `  ${result.escalation.model} (${result.escalation.tier}) — ${result.escalation.trigger}`);
    }
    lines.push('', 'why:', ...result.reasons.map((r) => `  - ${r}`));
    return { text: lines.join('\n'), exitCode: 0 };
}
//# sourceMappingURL=route.js.map