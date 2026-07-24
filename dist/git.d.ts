export interface ChangedFile {
    /** Two-char porcelain status, trimmed (e.g. 'M', 'A', '??'). */
    status: string;
    /** Repo-relative path. For renames, the destination path. */
    path: string;
}
/** Run a git subcommand at `cwd` and return stdout. Throws on non-zero exit. */
export declare function runGit(cwd: string, args: string[]): string;
/** Parse `git status --porcelain` output into changed files. Pure. */
export declare function parsePorcelain(output: string): ChangedFile[];
/** Changed (working-tree + staged) files at `cwd`. */
export declare function changedFiles(cwd: string): ChangedFile[];
/** Current branch name at `cwd`. */
export declare function currentBranch(cwd: string): string;
export interface DiffStats {
    fileCount: number;
    diffLines: number;
}
/**
 * Parse `git diff --numstat` output (`<added>\t<deleted>\t<path>` per line).
 * Binary files render as `-\t-\t<path>` and contribute to fileCount only. Pure.
 */
export declare function parseNumstat(output: string): DiffStats;
export interface RepoContext {
    fileCount: number;
    diffLines: number;
    /** Repo-relative paths of changed files (for critical-path detection). */
    paths: string[];
}
/**
 * Best-effort repo change context. With no `base`, reports the working-tree +
 * staged changes vs HEAD (plus untracked files). With a `base` ref, reports the
 * whole `base...HEAD` range (the "review this branch" case). Returns `null` when
 * the directory isn't a git repo or has no commits yet — the router then falls
 * back to any manually supplied signals.
 */
export declare function repoContext(cwd: string, base?: string): RepoContext | null;
