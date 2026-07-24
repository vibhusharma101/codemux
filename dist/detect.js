/**
 * Stack detection. Scans a repo root for well-known marker files and returns
 * the set of detected stacks. Pure with respect to the filesystem it is given
 * a path to — no global state, easy to test against fixture dirs.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
const MARKERS = [
    { stack: 'node', files: ['package.json'] },
    { stack: 'typescript', files: ['tsconfig.json'] },
    { stack: 'python', files: ['pyproject.toml', 'requirements.txt', 'setup.py'] },
    { stack: 'go', files: ['go.mod'] },
    { stack: 'rust', files: ['Cargo.toml'] },
    { stack: 'docker', files: ['Dockerfile', 'docker-compose.yml', 'compose.yaml'] },
    { stack: 'monorepo', files: ['pnpm-workspace.yaml', 'lerna.json', 'turbo.json'] },
];
/**
 * Detect the stacks present at `cwd`. A marker matches if any of its candidate
 * files exists. Returns detections in a stable, matrix-defined order.
 */
export function detectStack(cwd) {
    const detected = [];
    for (const marker of MARKERS) {
        if (marker.files.some((f) => existsSync(join(cwd, f)))) {
            detected.push(marker.stack);
        }
    }
    return detected;
}
//# sourceMappingURL=detect.js.map