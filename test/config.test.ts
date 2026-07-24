import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CONFIG_DIR,
  CONFIG_VERSION,
  defaultConfig,
  loadConfig,
} from '../src/config.js';
import { tempRepo } from './helpers.js';

test('defaultConfig includes every router intent and protects main', () => {
  const cfg = defaultConfig(['node']);
  assert.equal(cfg.version, CONFIG_VERSION);
  assert.deepEqual(cfg.stack, ['node']);
  assert.equal(cfg.router.architecture.model, 'claude-fable-5');
  assert.equal(cfg.router.docs.effort, 'low');
  assert.ok(cfg.hooks.pre.branchProtection.includes('main'));
});

test('loadConfig returns null when no config exists', () => {
  const { dir, cleanup } = tempRepo();
  try {
    assert.equal(loadConfig(dir), null);
  } finally {
    cleanup();
  }
});

test('loadConfig merges a partial config over defaults', () => {
  const { dir, cleanup } = tempRepo();
  try {
    mkdirSync(join(dir, CONFIG_DIR));
    writeFileSync(
      join(dir, CONFIG_DIR, 'config.json'),
      JSON.stringify({ stack: ['go'], hooks: { pre: { secretsScan: false } } }),
    );
    const cfg = loadConfig(dir);
    assert.ok(cfg);
    assert.deepEqual(cfg.stack, ['go']);
    // overridden field
    assert.equal(cfg.hooks.pre.secretsScan, false);
    // default preserved where not overridden
    assert.ok(cfg.hooks.pre.branchProtection.includes('main'));
    assert.equal(cfg.hooks.post.lint, true);
  } finally {
    cleanup();
  }
});

test('loadConfig throws a readable error on invalid JSON', () => {
  const { dir, cleanup } = tempRepo();
  try {
    mkdirSync(join(dir, CONFIG_DIR));
    writeFileSync(join(dir, CONFIG_DIR, 'config.json'), '{ not json');
    assert.throws(() => loadConfig(dir), /Invalid JSON/);
  } finally {
    cleanup();
  }
});
