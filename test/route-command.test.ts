import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRoute } from '../src/commands/route.js';
import { tempRepo } from './helpers.js';

test('runRoute errors on empty prompt', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, '   ');
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /prompt is required/);
  } finally {
    cleanup();
  }
});

test('runRoute prints tier, complexity, and directives', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'redesign the distributed architecture');
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
    const out = runRoute(dir, 'add a new feature', { json: true });
    const parsed = JSON.parse(out.text);
    assert.ok(parsed.tier);
    assert.equal(typeof parsed.confidence, 'number');
    assert.ok(Array.isArray(parsed.directives));
  } finally {
    cleanup();
  }
});

test('runRoute honors --files/--diff-lines signals', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'update things', {
      files: '30',
      diffLines: '900',
      json: true,
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
    const out = runRoute(dir, 'fix a typo in the docs');
    assert.match(out.text, /effort +n\/a/);
  } finally {
    cleanup();
  }
});
