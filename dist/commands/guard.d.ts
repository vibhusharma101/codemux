export interface GuardOptions {
    /** Branch name to check; defaults to the repo's current branch. */
    branch?: string;
}
export interface GuardOutput {
    text: string;
    exitCode: number;
}
/** Pure command core for `guard`. exitCode 1 when on a protected branch. */
export declare function runGuard(cwd: string, opts?: GuardOptions): GuardOutput;
