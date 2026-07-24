/**
 * Optional AI-assisted escalation.
 *
 * The deterministic router (classify.ts + router.ts) handles the large
 * majority of prompts correctly and for free. When its own confidence is low
 * — thin or contradictory signal — this module makes ONE cheap classification
 * call to Haiku 4.5, reusing whatever Anthropic credentials are already
 * configured on the machine (env var or an `ant auth login` profile — the SDK
 * resolves this automatically, no separate setup required).
 *
 * The judge never picks a model directly. It only returns a complexity
 * estimate and risk flags, which the router merges into its own scoring
 * (raising the tier, never lowering it) — so the final decision stays
 * explainable and the deterministic core stays the source of truth.
 *
 * Failure is always silent and safe: no credentials, no network, a timeout, a
 * refusal, or a malformed response all fall back to the deterministic result
 * with no exception ever escaping this module.
 */
import Anthropic from '@anthropic-ai/sdk';
/** The judge model: cheapest tier is plenty capable for this narrow task. */
export const JUDGE_MODEL = 'claude-haiku-4-5';
/** Network timeout for the judge call — fail fast rather than block the CLI. */
const JUDGE_TIMEOUT_MS = 8_000;
const KNOWN_RISKS = ['security', 'production', 'critical'];
function isRiskFlag(v) {
    return typeof v === 'string' && KNOWN_RISKS.includes(v);
}
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
/**
 * Extract the first JSON object from a text blob. Tolerant of surrounding prose
 * so the judge works on any model/SDK without depending on structured-output
 * support. Throws if no object is present (caught by the caller).
 */
function extractJsonObject(text) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end < start) {
        throw new Error('no JSON object found in judge response');
    }
    return JSON.parse(text.slice(start, end + 1));
}
function buildJudgePrompt(prompt, signals) {
    const lines = [
        'Classify the difficulty of this coding task for the purpose of picking a model tier.',
        '',
        `Task: "${prompt}"`,
    ];
    if (signals.fileCount !== undefined)
        lines.push(`Files changed: ${signals.fileCount}`);
    if (signals.diffLines !== undefined)
        lines.push(`Diff size: ~${signals.diffLines} lines`);
    if (signals.paths?.length)
        lines.push(`Changed paths: ${signals.paths.slice(0, 20).join(', ')}`);
    lines.push('', 'Estimate complexity 0-14 (0=trivial like a typo, 14=extremely hard long-horizon work).', 'Flag security/production/critical risk only if genuinely warranted by the task or paths.', '', 'Respond with ONLY a JSON object, no prose, in exactly this shape:', '{"complexity": <integer 0-14>, "risks": [<any of "security","production","critical">], "rationale": "<one short sentence>"}');
    return lines.join('\n');
}
/**
 * Run the judge call against an already-constructed client. Exported
 * separately so tests can inject a fake client and never touch the network.
 */
export async function judgeWithClient(client, prompt, signals = {}) {
    try {
        const res = await client.messages.create({
            model: JUDGE_MODEL,
            max_tokens: 300,
            messages: [{ role: 'user', content: buildJudgePrompt(prompt, signals) }],
        }, { timeout: JUDGE_TIMEOUT_MS });
        if (res.stop_reason === 'refusal') {
            return { ok: false, reason: 'judge model declined to classify' };
        }
        const textBlock = res.content.find((b) => b.type === 'text');
        if (!textBlock?.text)
            return { ok: false, reason: 'judge returned no text content' };
        const parsed = extractJsonObject(textBlock.text);
        if (typeof parsed !== 'object' || parsed === null) {
            return { ok: false, reason: 'judge output was not a JSON object' };
        }
        const obj = parsed;
        const complexity = clamp(Math.round(Number(obj.complexity)) || 0, 0, 14);
        const risks = Array.isArray(obj.risks) ? obj.risks.filter(isRiskFlag) : [];
        const rationale = typeof obj.rationale === 'string' ? obj.rationale.slice(0, 200) : '';
        return { ok: true, result: { complexity, risks, rationale } };
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return { ok: false, reason };
    }
}
/**
 * Construct a client from whatever credentials are already on the machine
 * (env var or an `ant auth login` profile) and run the judge. Never throws —
 * missing credentials, network failures, and malformed responses all resolve
 * to `{ ok: false, reason }`.
 */
export async function judgeComplexity(prompt, signals = {}) {
    let client;
    try {
        client = new Anthropic();
    }
    catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        return { ok: false, reason: `no Anthropic credentials available (${reason})` };
    }
    return judgeWithClient(client, prompt, signals);
}
//# sourceMappingURL=ai-judge.js.map