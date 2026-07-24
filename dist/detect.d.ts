export type Stack = 'node' | 'typescript' | 'python' | 'go' | 'rust' | 'docker' | 'monorepo';
/**
 * Detect the stacks present at `cwd`. A marker matches if any of its candidate
 * files exists. Returns detections in a stable, matrix-defined order.
 */
export declare function detectStack(cwd: string): Stack[];
