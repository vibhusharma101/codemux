/** Minimal shape of a Claude Code hook payload (fields kodemux actually reads). */
export interface HookPayload {
    cwd?: string;
    prompt?: string;
    tool_name?: string;
    tool_input?: {
        command?: string;
        file_path?: string;
        notebook_path?: string;
    };
}
export interface HookResult {
    /** JSON to print to stdout (context-injection hooks) or undefined for a block. */
    stdout?: string;
    /** JSON to print to stderr, only set when blocking. */
    stderr?: string;
    exitCode: 0 | 2;
}
/**
 * `UserPromptSubmit` hook. Runs the zero-network deterministic router on the
 * submitted prompt and injects the recommendation as additional context.
 * Never blocks — routing advice is informational, not enforced.
 */
export declare function userPromptSubmitHook(payload: HookPayload): Promise<HookResult>;
/** Does this Bash command look like a commit (the point secrets/branch matter)? */
export declare function isCommitCommand(command: string): boolean;
/**
 * `PreToolUse` hook for the Bash tool. Blocks a `git commit` when the branch
 * is protected or the staged/working changes contain a secret — turning the
 * existing advisory `guard`/`scan` commands into enforced guardrails.
 */
export declare function preToolUseHook(payload: HookPayload): Promise<HookResult>;
