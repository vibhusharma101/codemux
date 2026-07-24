import { test } from 'node:test';
import assert from 'node:assert/strict';
import { planPost } from '../src/hooks.js';
import { runPost } from '../src/commands/post.js';
import { defaultConfig } from '../src/config.js';
import { tempRepo } from './helpers.js';

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
