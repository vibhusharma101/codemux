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

test('runRoute prints human-readable directives', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'refactor the architecture');
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /intent {6}architecture/);
    assert.match(out.text, /\/model claude-fable-5/);
  } finally {
    cleanup();
  }
});

test('runRoute --json emits valid parseable JSON', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'add a new feature', { json: true });
    const parsed = JSON.parse(out.text);
    assert.equal(parsed.intent, 'feature');
    assert.ok(Array.isArray(parsed.directives));
  } finally {
    cleanup();
  }
});

test('runRoute honors --files signal for architecture', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = runRoute(dir, 'update things', { files: '30', diffLines: '800', json: true });
    const parsed = JSON.parse(out.text);
    assert.equal(parsed.intent, 'architecture');
  } finally {
    cleanup();
  }
});
