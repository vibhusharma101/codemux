/**
 * Post-hook planning. Given the changed files and config, decide which scoped
 * formatters / linters / tests should run. Planning is pure and testable;
 * execution is a separate opt-in step.
 */
import { extname } from 'node:path';
const LANGS = [
    {
        exts: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'],
        format: 'prettier --write',
        lint: 'eslint',
        test: 'npm test',
    },
    { exts: ['.py'], format: 'black', lint: 'ruff check', test: 'pytest' },
    { exts: ['.go'], format: 'gofmt -w', lint: 'golangci-lint run', test: 'go test ./...' },
    { exts: ['.rs'], format: 'cargo fmt', lint: 'cargo clippy', test: 'cargo test' },
];
function langFor(file) {
    const ext = extname(file).toLowerCase();
    return LANGS.find((l) => l.exts.includes(ext));
}
/**
 * Build the scoped post-hook plan. Groups changed files by language and emits
 * format/lint steps for the touched files plus a single test step per language,
 * gated by the config's post-hook flags.
 */
export function planPost(files, config) {
    const post = config.hooks.post;
    const byLang = new Map();
    for (const f of files) {
        const lang = langFor(f);
        if (!lang)
            continue;
        const list = byLang.get(lang) ?? [];
        list.push(f);
        byLang.set(lang, list);
    }
    const steps = [];
    for (const [lang, langFiles] of byLang) {
        if (post.format) {
            steps.push({
                kind: 'format',
                tool: lang.format.split(' ')[0],
                command: `${lang.format} ${langFiles.join(' ')}`,
                files: langFiles,
            });
        }
        if (post.lint) {
            steps.push({
                kind: 'lint',
                tool: lang.lint.split(' ')[0],
                command: `${lang.lint} ${langFiles.join(' ')}`,
                files: langFiles,
            });
        }
        if (post.scopedTests) {
            steps.push({
                kind: 'test',
                tool: lang.test.split(' ')[0],
                command: lang.test,
                files: langFiles,
            });
        }
    }
    return steps;
}
//# sourceMappingURL=hooks.js.map