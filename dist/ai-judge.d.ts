import type { RiskFlag, Signals } from './classify.js';
/** The judge model: cheapest tier is plenty capable for this narrow task. */
export declare const JUDGE_MODEL = "claude-haiku-4-5";
export interface JudgeResult {
    complexity: number;
    risks: RiskFlag[];
    rationale: string;
}
export type JudgeOutcome = {
    ok: true;
    result: JudgeResult;
} | {
    ok: false;
    reason: string;
};
/** Minimal shape this module needs from an Anthropic client — for test injection. */
export interface MinimalAnthropicClient {
    messages: {
        create(params: unknown, options?: {
            timeout?: number;
        }): Promise<{
            stop_reason?: string;
            content: Array<{
                type: string;
                text?: string;
            }>;
        }>;
    };
}
/**
 * Run the judge call against an already-constructed client. Exported
 * separately so tests can inject a fake client and never touch the network.
 */
export declare function judgeWithClient(client: MinimalAnthropicClient, prompt: string, signals?: Signals): Promise<JudgeOutcome>;
/**
 * Construct a client from whatever credentials are already on the machine
 * (env var or an `ant auth login` profile) and run the judge. Never throws —
 * missing credentials, network failures, and malformed responses all resolve
 * to `{ ok: false, reason }`.
 */
export declare function judgeComplexity(prompt: string, signals?: Signals): Promise<JudgeOutcome>;
