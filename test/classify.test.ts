import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from '../src/classify.js';

test('security keywords win', () => {
  const r = classifyIntent('run a security audit for OWASP vulnerabilities');
  assert.equal(r.intent, 'security');
  assert.ok(r.confidence > 0);
});

test('architecture keywords win', () => {
  const r = classifyIntent('refactor and redesign the whole auth system');
  assert.equal(r.intent, 'architecture');
});

test('bugfix keywords win', () => {
  const r = classifyIntent('fix the crash when the token is broken');
  assert.equal(r.intent, 'bugfix');
});

test('docs keywords win (tests count as docs-tier)', () => {
  const r = classifyIntent('add unit tests and update the README documentation');
  assert.equal(r.intent, 'docs');
});

test('empty-ish prompt defaults to feature with zero confidence', () => {
  const r = classifyIntent('please do the thing');
  assert.equal(r.intent, 'feature');
  assert.equal(r.confidence, 0);
});

test('large file count pushes toward architecture', () => {
  const r = classifyIntent('update code across the repo', { fileCount: 25, diffLines: 900 });
  assert.equal(r.intent, 'architecture');
  assert.ok(r.reasons.some((x) => x.includes('large change')));
});

test('reasons explain the winning keywords', () => {
  const r = classifyIntent('implement a new feature endpoint');
  assert.equal(r.intent, 'feature');
  assert.ok(r.reasons.some((x) => x.includes('feature keywords')));
});
