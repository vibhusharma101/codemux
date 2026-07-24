/**
 * `codemux scan` — pre-hook secrets scan of changed files.
 */
import { join } from 'node:path';
import { changedFiles } from '../git.js';
import { scanFiles, type Finding } from '../scan.js';

export interface ScanOptions {
  /** Absolute file paths to scan; defaults to git-changed files at cwd. */
  files?: string[];
  json?: boolean;
}

export interface ScanOutput {
  text: string;
  exitCode: number;
  findings: Finding[];
}

/** Pure command core for `scan`. exitCode 1 when any secret is found. */
export function runScan(cwd: string, opts: ScanOptions = {}): ScanOutput {
  const paths =
    opts.files ?? changedFiles(cwd).map((f) => join(cwd, f.path));
  const findings = scanFiles(paths);

  if (opts.json) {
    return {
      text: JSON.stringify({ findings }, null, 2),
      exitCode: findings.length ? 1 : 0,
      findings,
    };
  }

  if (findings.length === 0) {
    return { text: 'codemux scan: no secrets found in changed files.', exitCode: 0, findings };
  }

  const lines = [
    `codemux scan: ${findings.length} potential secret(s) found:`,
    ...findings.map((f) => `  ${f.file}:${f.line}  [${f.rule}]  ${f.match}`),
    '',
    'Remove or vault these before handing off to an agent.',
  ];
  return { text: lines.join('\n'), exitCode: 1, findings };
}
