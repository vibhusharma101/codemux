export interface CodexInstallOptions {
    /** Install into ~/.codex/AGENTS.md instead of the project's AGENTS.md. */
    global?: boolean;
}
export interface CodexInstallOutput {
    text: string;
    exitCode: number;
}
export declare const BEGIN_MARKER = "<!-- BEGIN kodemux -->";
export declare const END_MARKER = "<!-- END kodemux -->";
/** The managed block. Kept verbatim so re-running detects "no changes". */
export declare function kodemuxBlock(): string;
/**
 * Replace an existing kodemux block, or append one. Returns null when the file
 * already contains exactly this block (nothing to do).
 */
export declare function upsertBlock(existing: string, block: string): string | null;
export declare function installCodex(cwd: string, opts?: CodexInstallOptions): CodexInstallOutput;
