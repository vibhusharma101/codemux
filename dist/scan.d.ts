export interface SecretRule {
    name: string;
    re: RegExp;
}
/** Detection rules. Sources are stored source-only; matching uses fresh regexes. */
export declare const SECRET_RULES: SecretRule[];
export interface Finding {
    rule: string;
    file: string;
    line: number;
    /** Masked snippet — never the raw secret. */
    match: string;
}
/** Reveal the first 4 and last 2 chars; mask the middle. */
export declare function mask(secret: string): string;
/** Scan a blob of text. Pure — no filesystem access. */
export declare function scanText(text: string, file?: string): Finding[];
/** Scan a list of absolute file paths. Missing/large files are skipped. */
export declare function scanFiles(paths: string[]): Finding[];
