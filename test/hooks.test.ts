import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPost } from '../src/hooks.js';
import { runPost, stepIsShellSafe } from '../src/commands/post.js';
import { defaultConfig } from '../src/config.js';
import { tempRepo } from './helpers.js';

test('stepIsShellSafe rejects filenames with shell metacharacters', () => {
  assert.equal(stepIsShellSafe({ kind: 'format', tool: 'prettier', command: 'x', files: ['src/a.ts'] }), true);
  assert.equal(
    stepIsShellSafe({ kind: 'format', tool: 'prettier', command: 'x', files: ['foo;rm -rf ~.ts'] }),
    false,
  );
  assert.equal(
    stepIsShellSafe({ kind: 'format', tool: 'prettier', command: 'x', files: ['$(whoami).ts'] }),
    false,
  );
});

test('runPost --run skips (does not execute) a step with a shell-unsafe path', () => {
  const { dir, cleanup } = tempRepo();
  try {
    // If this were executed via the shell, the injected command would run. The
    // guard must skip it instead — and because it is skipped, no real tool is
    // ever invoked, so the test is safe and deterministic.
    const out = runPost(dir, { files: ['foo;touch INJECTED.ts'], run: true });
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /shell-unsafe/);
  } finally {
    cleanup();
  }
});

test('planPost emits format/lint/test for changed TS files', () => {
  const cfg = defaultConfig(['node']);
  const steps = planPost(['src/a.ts', 'src/b.ts'], cfg);
  assert.ok(steps.some((s) => s.kind === 'format' && s.tool === 'prettier'));
  assert.ok(steps.some((s) => s.kind === 'lint' && s.tool === 'eslint'));
  assert.ok(steps.some((s) => s.kind === 'test' && s.command === 'npm test'));
});

test('planPost groups multiple languages', () => {
  const cfg = defaultConfig([]);
  const steps = planPost(['a.ts', 'b.py', 'c.go'], cfg);
  assert.ok(steps.some((s) => s.command.includes('black')));
  assert.ok(steps.some((s) => s.command.includes('gofmt')));
});

test('planPost respects disabled hook flags', () => {
  const cfg = defaultConfig(['node']);
  cfg.hooks.post.format = false;
  cfg.hooks.post.lint = false;
  const steps = planPost(['a.ts'], cfg);
  assert.ok(steps.every((s) => s.kind === 'test'));
});

test('planPost ignores files with no known language', () => {
  const cfg = defaultConfig([]);
  assert.deepEqual(planPost(['README.md', 'image.png'], cfg), []);
});

test('runPost dry-run lists steps without executing', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runPost(dir, { files: ['src/a.ts'] });
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /dry-run/);
    assert.ok(out.steps.length > 0);
  } finally {
    cleanup();
  }
});

test('runPost reports nothing to do for non-code changes', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runPost(dir, { files: ['docs/guide.md'] });
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /no formatter/);
  } finally {
    cleanup();
  }
});
