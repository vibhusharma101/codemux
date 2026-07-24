import { type PostStep } from '../hooks.js';
export interface PostOptions {
    /** Repo-relative changed file paths; defaults to git-changed files. */
    files?: string[];
    /** Actually execute the plan (default is dry-run / plan only). */
    run?: boolean;
    json?: boolean;
}
export interface PostOutput {
    text: string;
    exitCode: number;
    steps: PostStep[];
}
export declare function stepIsShellSafe(step: PostStep): boolean;
/**
 * Pure planning + optional execution. In plan mode (default) this never shells
 * out, so it is safe and deterministic in tests.
 */
export declare function runPost(cwd: string, opts?: PostOptions): PostOutput;
