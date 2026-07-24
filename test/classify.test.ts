import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../src/classify.js';

test('a typo fix is low complexity, docs intent, no risk', () => {
  const a = analyze('fix a typo in the README');
  assert.equal(a.intent, 'docs');
  assert.equal(a.complexity, 0);
  assert.deepEqual(a.risks, []);
  assert.ok(a.simplicityHits.includes('typo'));
});

test('a distributed-systems task scores high complexity', () => {
  const a = analyze('design a distributed consensus protocol, optimize latency');
  assert.ok(a.complexity >= 9, `expected >=9, got ${a.complexity}`);
  assert.ok(a.complexityHits.includes('distributed'));
});

test('explicit connectors mark a multi-step request', () => {
  const a = analyze('add logging and then refactor the parser');
  assert.ok(a.multiStep);
});

test('security work raises a security risk flag', () => {
  const a = analyze('run a security audit for OWASP vulnerabilities');
  assert.equal(a.intent, 'security');
  assert.ok(a.risks.includes('security'));
});

test('production/migration work raises a production risk flag', () => {
  const a = analyze('write the database migration and deploy to production');
  assert.ok(a.risks.includes('production'));
});

test('conflicting signals are both recorded', () => {
  const a = analyze('a trivial rename, but it touches the concurrency model');
  assert.ok(a.simplicityHits.length > 0);
  assert.ok(a.complexityHits.length > 0);
});

test('repo signals push complexity up for large changes', () => {
  const small = analyze('update code', { fileCount: 1, diffLines: 10 });
  const large = analyze('update code', { fileCount: 25, diffLines: 900 });
  assert.ok(large.complexity > small.complexity);
});

test('empty-ish prompt defaults to feature intent', () => {
  const a = analyze('please do the thing');
  assert.equal(a.intent, 'feature');
  assert.equal(a.complexity, 0);
});
