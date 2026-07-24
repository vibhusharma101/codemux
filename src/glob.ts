/**
 * Minimal, dependency-free glob matching for critical-path detection.
 *
 * Supports `**` (any depth), `*` (within a path segment), and `?` (one non-slash
 * char). Matching is anchored to a path-segment boundary so `auth/` matches
 * `src/auth/x.ts` but not `myauth/x.ts`. Pure and case-insensitive.
 */

function globToRegExp(pattern: string): RegExp {
  const pat = pattern.replace(/\\/g, '/');
  let re = '';
  let i = 0;
  while (i < pat.length) {
    if (pat.startsWith('**/', i)) {
      re += '(?:.*/)?'; // zero or more directories (matches root-level too)
      i += 3;
      continue;
    }
    if (pat.startsWith('**', i)) {
      re += '.*';
      i += 2;
      continue;
    }
    const c = pat[i]!;
    if (c === '*') re += '[^/]*';
    else if (c === '?') re += '[^/]';
    else if ('.+^${}()|[]\\'.includes(c)) re += '\\' + c;
    else re += c;
    i++;
  }
  // Anchor to a path-segment boundary (start of path or after a slash).
  return new RegExp('(^|/)' + re, 'i');
}

/** Does `path` match this single glob pattern? */
export function matchGlob(path: string, pattern: string): boolean {
  return globToRegExp(pattern).test(path.replace(/\\/g, '/'));
}

/** Does `path` match any of the patterns? */
export function matchesAny(path: string, patterns: string[]): boolean {
  return patterns.some((p) => matchGlob(path, p));
}
