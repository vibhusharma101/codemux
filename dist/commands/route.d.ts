import { judgeComplexity } from '../ai-judge.js';
export interface RouteCommandOptions {
    files?: string;
    diffLines?: string;
    json?: boolean;
    /** Diff against a base ref (e.g. `main`) instead of the working tree. */
    base?: string;
    /** Commander sets this to false for `--no-git`. */
    git?: boolean;
    /** Commander sets this to false for `--no-ai`. */
    ai?: boolean;
}
export interface RouteCommandOutput {
    text: string;
    exitCode: number;
}
/** Injectable dependencies — the judge is swapped for a fake in tests. */
export interface RouteCommandDeps {
    judge?: typeof judgeComplexity;
}
/**
 * Core: takes cwd + prompt + options, returns text to print and an exit code.
 * Side effects are reading git state (skippable via `--no-git`) and, only when
 * confidence is low, one AI-assist call (skippable via `--no-ai`) — both fail
 * safe and never throw.
 */
export declare function runRoute(cwd: string, prompt: string, opts?: RouteCommandOptions, deps?: RouteCommandDeps): Promise<RouteCommandOutput>;
