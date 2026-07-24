/**
 * `kodemux scan` — pre-hook secrets scan of changed files.
 */
import { join } from 'node:path';
import { changedFiles } from '../git.js';
import { scanFiles } from '../scan.js';
/** Pure command core for `scan`. exitCode 1 when any secret is found. */
export function runScan(cwd, opts = {}) {
    const paths = opts.files ?? changedFiles(cwd).map((f) => join(cwd, f.path));
    const findings = scanFiles(paths);
    if (opts.json) {
        return {
            text: JSON.stringify({ findings }, null, 2),
            exitCode: findings.length ? 1 : 0,
            findings,
        };
    }
    if (findings.length === 0) {
        return { text: 'kodemux scan: no secrets found in changed files.', exitCode: 0, findings };
    }
    const lines = [
        `kodemux scan: ${findings.length} potential secret(s) found:`,
        ...findings.map((f) => `  ${f.file}:${f.line}  [${f.rule}]  ${f.match}`),
        '',
        'Remove or vault these before handing off to an agent.',
    ];
    return { text: lines.join('\n'), exitCode: 1, findings };
}
//# sourceMappingURL=scan.js.map