/**
 * Thin git helpers. Higher-level functions shell out to git; the parsing logic
 * is factored into pure functions so it can be tested without a repo.
 */
import { execFileSync } from 'node:child_process';

export interface ChangedFile {
  /** Two-char porcelain status, trimmed (e.g. 'M', 'A', '??'). */
  status: string;
  /** Repo-relative path. For renames, the destination path. */
  path: string;
}

/** Run a git subcommand at `cwd` and return stdout. Throws on non-zero exit. */
export function runGit(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' });
}

/** Parse `git status --porcelain` output into changed files. Pure. */
export function parsePorcelain(output: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  for (const raw of output.split('\n')) {
    if (!raw.trim()) continue;
    const status = raw.slice(0, 2).trim();
    let path = raw.slice(3).trim();
    // Renames/copies render as "old -> new"; keep the destination.
    const arrow = path.indexOf(' -> ');
    if (arrow !== -1) path = path.slice(arrow + 4).trim();
    // Strip surrounding quotes git adds for paths with special chars.
    if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
    files.push({ status, path });
  }
  return files;
}

/** Changed (working-tree + staged) files at `cwd`. */
export function changedFiles(cwd: string): ChangedFile[] {
  return parsePorcelain(runGit(cwd, ['status', '--porcelain']));
}

/** Current branch name at `cwd`. */
export function currentBranch(cwd: string): string {
  return runGit(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
}

export interface DiffStats {
  fileCount: number;
  diffLines: number;
}

/**
 * Parse `git diff --numstat` output (`<added>\t<deleted>\t<path>` per line).
 * Binary files render as `-\t-\t<path>` and contribute to fileCount only. Pure.
 */
export function parseNumstat(output: string): DiffStats {
  let fileCount = 0;
  let diffLines = 0;
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    fileCount++;
    const added = Number(parts[0]);
    const deleted = Number(parts[1]);
    if (!Number.isNaN(added)) diffLines += added;
    if (!Number.isNaN(deleted)) diffLines += deleted;
  }
  return { fileCount, diffLines };
}

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
export function repoContext(cwd: string, base?: string): RepoContext | null {
  try {
    if (base) {
      const paths = runGit(cwd, ['diff', '--name-only', `${base}...HEAD`])
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const stats = parseNumstat(runGit(cwd, ['diff', '--numstat', `${base}...HEAD`]));
      return { fileCount: paths.length, diffLines: stats.diffLines, paths };
    }
    const paths = changedFiles(cwd).map((f) => f.path);
    const stats = parseNumstat(runGit(cwd, ['diff', '--numstat', 'HEAD']));
    // porcelain path count includes untracked files that numstat misses
    return { fileCount: Math.max(paths.length, stats.fileCount), diffLines: stats.diffLines, paths };
  } catch {
    return null;
  }
}
