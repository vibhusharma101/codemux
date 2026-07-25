export interface HooksInstallOptions {
    /** Install into ~/.claude/settings.json instead of the project's .claude/. */
    global?: boolean;
}
export interface HooksInstallOutput {
    text: string;
    exitCode: number;
}
export declare function installHooks(cwd: string, opts?: HooksInstallOptions): HooksInstallOutput;
