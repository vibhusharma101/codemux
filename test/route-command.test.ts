import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRoute } from '../src/commands/route.js';
import { tempRepo } from './helpers.js';

// `git: false` keeps these hermetic — the router's git auto-detection is tested
// separately; here we exercise the command formatting and manual signals.

test('runRoute errors on empty prompt', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, '   ', { git: false });
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /prompt is required/);
  } finally {
    cleanup();
  }
});

test('runRoute prints tier, complexity, and directives', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'redesign the distributed architecture', { git: false });
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /complexity/);
    assert.match(out.text, /tier/);
    assert.match(out.text, /\/model claude-/);
  } finally {
    cleanup();
  }
});

test('runRoute --json emits a parseable decision', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'add a new feature', { json: true, git: false });
    const parsed = JSON.parse(out.text);
    assert.ok(parsed.tier);
    assert.equal(typeof parsed.confidence, 'number');
    assert.ok(Array.isArray(parsed.directives));
    assert.equal(parsed.detected, null); // git disabled
  } finally {
    cleanup();
  }
});

test('runRoute honors --files/--diff-lines overrides', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'update things', {
      files: '30',
      diffLines: '900',
      json: true,
      git: false,
    });
    const parsed = JSON.parse(out.text);
    assert.ok(['complex', 'frontier'].includes(parsed.tier));
  } finally {
    cleanup();
  }
});

test('runRoute shows n/a effort for the Haiku (simple) tier', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'fix a typo in the docs', { git: false });
    assert.match(out.text, /effort +n\/a/);
  } finally {
    cleanup();
  }
});
