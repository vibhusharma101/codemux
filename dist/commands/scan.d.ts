import { type Finding } from '../scan.js';
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
export declare function runScan(cwd: string, opts?: ScanOptions): ScanOutput;
