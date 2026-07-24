/**
 * Secrets scanner. Detects secret-shaped strings so they never leave the repo
 * with an AI-generated change. Pattern matching is pure and testable; file IO
 * is a thin wrapper on top.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
/** Detection rules. Sources are stored source-only; matching uses fresh regexes. */
export const SECRET_RULES = [
    { name: 'github-token', re: /ghp_[A-Za-z0-9]{36}/ },
    { name: 'github-fine-grained-pat', re: /github_pat_[A-Za-z0-9_]{60,}/ },
    { name: 'openai-key', re: /sk-[A-Za-z0-9]{20,}/ },
    { name: 'aws-access-key-id', re: /AKIA[0-9A-Z]{16}/ },
    { name: 'slack-token', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
    { name: 'google-api-key', re: /AIza[0-9A-Za-z_-]{35}/ },
    { name: 'private-key-block', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/ },
];
/** Reveal the first 4 and last 2 chars; mask the middle. */
export function mask(secret) {
    if (secret.length <= 8)
        return secret[0] + '****';
    return secret.slice(0, 4) + '****' + secret.slice(-2);
}
/** Scan a blob of text. Pure — no filesystem access. */
export function scanText(text, file = '<text>') {
    const findings = [];
    const lines = text.split('\n');
    lines.forEach((line, i) => {
        for (const rule of SECRET_RULES) {
            const re = new RegExp(rule.re.source, 'g');
            let m;
            while ((m = re.exec(line)) !== null) {
                findings.push({ rule: rule.name, file, line: i + 1, match: mask(m[0]) });
                if (m.index === re.lastIndex)
                    re.lastIndex++; // guard against zero-width
            }
        }
    });
    return findings;
}
const MAX_BYTES = 1024 * 1024; // skip files larger than 1 MiB
/** Scan a list of absolute file paths. Missing/large files are skipped. */
export function scanFiles(paths) {
    const findings = [];
    for (const p of paths) {
        if (!existsSync(p))
            continue;
        let size = 0;
        try {
            size = statSync(p).size;
        }
        catch {
            continue;
        }
        if (size > MAX_BYTES)
            continue;
        let text;
        try {
            text = readFileSync(p, 'utf8');
        }
        catch {
            continue; // unreadable / binary
        }
        findings.push(...scanText(text, p));
    }
    return findings;
}
//# sourceMappingURL=scan.js.map