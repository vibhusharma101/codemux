import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, directivesFor } from '../src/router.js';
import { defaultConfig } from '../src/config.js';
import { MODELS } from '../src/constants/models.js';

test('a typo fix routes to the simple tier (Haiku, no effort)', () => {
  const r = route('fix a typo in the README');
  assert.equal(r.tier, 'simple');
  assert.equal(r.target.model, MODELS.HAIKU_4_5);
  assert.equal(r.target.effort, null);
  // no /effort directive for a model without effort control
  assert.deepEqual(r.directives, ['/model claude-haiku-4-5', '/mode single']);
});

test('a distributed-systems task routes to the frontier tier (Fable)', () => {
  const r = route('design a distributed consensus protocol from scratch, optimize latency across the entire system');
  assert.equal(r.tier, 'frontier');
  assert.equal(r.target.model, MODELS.FABLE_5);
  assert.ok(['xhigh', 'max'].includes(r.target.effort as string));
});

test('an everyday feature routes to the standard tier (Sonnet) with a plan', () => {
  const r = route('add a CSV export endpoint');
  assert.equal(r.tier, 'standard');
  assert.equal(r.target.model, MODELS.SONNET_5);
  assert.ok(r.directives.includes('/plan'));
});

test('security work floors at the complex tier and audits are read-only', () => {
  const r = route('run a security audit for OWASP vulnerabilities');
  assert.ok(r.risks.includes('security'));
  assert.equal(r.target.model, MODELS.OPUS_4_8); // risk floor = complex
  assert.equal(r.target.mode, 'read-only');
});

test('architecture intent floors at the complex tier', () => {
  const r = route('redesign the module architecture');
  assert.equal(r.tier, 'complex');
  assert.equal(r.target.model, MODELS.OPUS_4_8);
});

test('low confidence produces an escalation recommendation', () => {
  // conflicting/thin signal → not fully confident → cascade hint
  const r = route('touch the concurrency thing but keep it a small rename');
  assert.ok(r.confidence < 0.6);
  assert.ok(r.escalation);
  assert.notEqual(r.escalation!.model, r.target.model);
});

test('repo signals alone can push a vague prompt to a higher tier', () => {
  const small = route('update things', undefined, { fileCount: 1, diffLines: 10 });
  const large = route('update things', undefined, { fileCount: 30, diffLines: 900 });
  assert.ok(
    ['complex', 'frontier'].includes(large.tier),
    `expected complex/frontier, got ${large.tier}`,
  );
  assert.notEqual(large.tier, small.tier);
});

test('config overrides are respected (tier model + thresholds)', () => {
  const cfg = defaultConfig(['node']);
  cfg.router.tiers.standard.model = MODELS.OPUS_4_8;
  const r = route('add a small feature', cfg);
  assert.equal(r.tier, 'standard');
  assert.equal(r.target.model, MODELS.OPUS_4_8);
});

test('single-agent modes recommend exactly one agent', () => {
  const r = route('fix a typo in the README');
  assert.equal(r.parallelAgents, 1);
  assert.ok(!r.directives.some((d) => d.startsWith('/agents')));
});

test('a large, wide-scope task fans out to multiple parallel agents', () => {
  const r = route(
    'refactor the entire codebase architecture across every module',
    undefined,
    { fileCount: 40, diffLines: 1200 },
  );
  assert.equal(r.target.mode, 'multi-agent');
  assert.ok(r.parallelAgents >= 3, `expected >=3 agents, got ${r.parallelAgents}`);
  assert.ok(r.directives.includes(`/agents ${r.parallelAgents}`));
});

test('touching a critical path floors the tier even with innocuous wording', () => {
  // wording alone would route to `simple`/`standard`; the auth path forces up.
  const r = route('tweak a default value', undefined, { paths: ['src/auth/session.ts'] });
  assert.ok(r.risks.includes('critical'));
  assert.equal(r.target.model, MODELS.OPUS_4_8); // risk floor = complex
});

test('a non-critical path adds no risk', () => {
  const r = route('tweak a default value', undefined, { paths: ['src/utils/format.ts'] });
  assert.ok(!r.risks.includes('critical'));
});

test('directivesFor omits /effort when the model has none', () => {
  const withEffort = directivesFor({ model: MODELS.SONNET_5, effort: 'high', mode: 'plan' });
  assert.deepEqual(withEffort, ['/model claude-sonnet-5', '/effort high', '/plan']);
  const noEffort = directivesFor({ model: MODELS.HAIKU_4_5, effort: null, mode: 'single' });
  assert.deepEqual(noEffort, ['/model claude-haiku-4-5', '/mode single']);
});
