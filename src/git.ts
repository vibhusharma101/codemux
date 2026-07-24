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
