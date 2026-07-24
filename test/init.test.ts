import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { init } from '../src/commands/init.js';
import { loadConfig } from '../src/config.js';
import { tempRepo } from './helpers.js';

test('init scaffolds .kodemux with config and CLAUDE.md', () => {
  const { dir, cleanup } = tempRepo();
  try {
    writeFileSync(join(dir, 'package.json'), '{}');
    const result = init(dir);
    assert.ok(existsSync(join(dir, '.kodemux', 'config.json')));
    assert.ok(existsSync(join(dir, '.kodemux', 'CLAUDE.md')));
    assert.ok(result.created.some((f) => f.endsWith('config.json')));
    assert.ok(result.config.stack.includes('node'));

    // config on disk round-trips through the loader
    const loaded = loadConfig(dir);
    assert.ok(loaded);
    assert.deepEqual(loaded.stack, result.config.stack);
  } finally {
    cleanup();
  }
});

test('init is idempotent — second run skips existing files', () => {
  const { dir, cleanup } = tempRepo();
  try {
    init(dir);
    const second = init(dir);
    assert.equal(second.created.length, 0);
    assert.ok(second.skipped.some((f) => f.includes('config.json')));
  } finally {
    cleanup();
  }
});

test('init --force overwrites existing config', () => {
  const { dir, cleanup } = tempRepo();
  try {
    init(dir);
    const forced = init(dir, { force: true });
    assert.ok(forced.created.some((f) => f.endsWith('config.json')));
    assert.equal(forced.skipped.length, 0);
  } finally {
    cleanup();
  }
});
