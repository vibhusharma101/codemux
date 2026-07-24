/**
 * Minimal, dependency-free glob matching for critical-path detection.
 *
 * Supports `**` (any depth), `*` (within a path segment), and `?` (one non-slash
 * char). Matching is anchored to a path-segment boundary so `auth/` matches
 * `src/auth/x.ts` but not `myauth/x.ts`. Pure and case-insensitive.
 */
/** Does `path` match this single glob pattern? */
export declare function matchGlob(path: string, pattern: string): boolean;
/** Does `path` match any of the patterns? */
export declare function matchesAny(path: string, patterns: string[]): boolean;
