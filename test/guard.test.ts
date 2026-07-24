import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runGuard } from '../src/commands/guard.js';
import { CONFIG_DIR } from '../src/config.js';
import { tempRepo } from './helpers.js';

test('guard blocks a protected branch (default list)', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runGuard(dir, { branch: 'main' });
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /refusing direct edits/);
  } finally {
    cleanup();
  }
});

test('guard allows a feature branch', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runGuard(dir, { branch: 'feat/thing' });
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /ok to proceed/);
  } finally {
    cleanup();
  }
});

test('guard honors a custom protected list from config', () => {
  const { dir, cleanup } = tempRepo();
  try {
    mkdirSync(join(dir, CONFIG_DIR));
    writeFileSync(
      join(dir, CONFIG_DIR, 'config.json'),
      JSON.stringify({ hooks: { pre: { branchProtection: ['release'] } } }),
    );
    assert.equal(runGuard(dir, { branch: 'release' }).exitCode, 1);
    // 'main' is not in the custom list, so it is allowed here
    assert.equal(runGuard(dir, { branch: 'main' }).exitCode, 0);
  } finally {
    cleanup();
  }
});
