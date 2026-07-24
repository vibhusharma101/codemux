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

test('defaultConfig builds the capability ladder and protects main', () => {
  const cfg = defaultConfig(['node']);
  assert.equal(cfg.version, CONFIG_VERSION);
  assert.deepEqual(cfg.stack, ['node']);
  assert.equal(cfg.router.tiers.simple.model, 'claude-haiku-4-5');
  assert.equal(cfg.router.tiers.standard.model, 'claude-sonnet-5');
  assert.equal(cfg.router.tiers.complex.model, 'claude-opus-4-8');
  assert.equal(cfg.router.tiers.frontier.model, 'claude-fable-5');
  assert.equal(cfg.router.tiers.simple.efforts[0], null); // Haiku has no effort
  assert.equal(cfg.router.riskFloor, 'complex');
  assert.ok(cfg.router.criticalPaths.includes('**/auth/**'));
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
      JSON.stringify({
        stack: ['go'],
        router: { thresholds: { complex: 3 } },
        hooks: { pre: { secretsScan: false } },
      }),
    );
    const cfg = loadConfig(dir);
    assert.ok(cfg);
    assert.deepEqual(cfg.stack, ['go']);
    // overridden threshold
    assert.equal(cfg.router.thresholds.complex, 3);
    // defaults preserved where not overridden
    assert.equal(cfg.router.thresholds.frontier, 9);
    assert.equal(cfg.router.tiers.complex.model, 'claude-opus-4-8');
    assert.equal(cfg.hooks.pre.secretsScan, false);
    assert.ok(cfg.hooks.pre.branchProtection.includes('main'));
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
