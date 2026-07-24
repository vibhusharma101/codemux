/**
 * `kodemux guard` — pre-hook branch protection. Refuses direct edits on a
 * protected branch so agents are forced onto feature branches.
 */
import { currentBranch } from '../git.js';
import { loadConfig } from '../config.js';

const DEFAULT_PROTECTED = ['main', 'master', 'production'];

export interface GuardOptions {
  /** Branch name to check; defaults to the repo's current branch. */
  branch?: string;
}

export interface GuardOutput {
  text: string;
  exitCode: number;
}

/** Pure command core for `guard`. exitCode 1 when on a protected branch. */
export function runGuard(cwd: string, opts: GuardOptions = {}): GuardOutput {
  const config = loadConfig(cwd);
  const protectedBranches =
    config?.hooks.pre.branchProtection ?? DEFAULT_PROTECTED;
  const branch = opts.branch ?? currentBranch(cwd);

  if (protectedBranches.includes(branch)) {
    return {
      text:
        `kodemux guard: refusing direct edits on protected branch '${branch}'.\n` +
        `Create a feature branch first (e.g. git checkout -b feat/your-change).`,
      exitCode: 1,
    };
  }
  return {
    text: `kodemux guard: branch '${branch}' is not protected — ok to proceed.`,
    exitCode: 0,
  };
}
