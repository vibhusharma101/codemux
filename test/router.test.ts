import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, directivesFor } from '../src/router.js';
import { defaultConfig } from '../src/config.js';
import { MODELS } from '../src/constants/models.js';

test('routes a docs prompt to haiku/low/single', () => {
  const r = route('fix a typo in the README');
  assert.equal(r.target.model, MODELS.HAIKU_4_5);
  assert.equal(r.target.effort, 'low');
  assert.deepEqual(r.directives, [
    '/model claude-haiku-4-5',
    '/effort low',
    '/mode single',
  ]);
});

test('routes an architecture prompt to fable/xhigh/multi-agent', () => {
  const r = route('massive refactor of the system architecture');
  assert.equal(r.target.model, MODELS.FABLE_5);
  assert.equal(r.target.effort, 'xhigh');
  assert.ok(r.directives.includes('/mode multi-agent'));
});

test('feature prompt emits /plan directive', () => {
  const r = route('implement a new export feature');
  assert.equal(r.intent, 'feature');
  assert.ok(r.directives.includes('/plan'));
});

test('config router overrides are respected', () => {
  const cfg = defaultConfig(['node']);
  cfg.router.docs = { model: MODELS.SONNET_5, effort: 'medium', mode: 'single' };
  const r = route('update the documentation', cfg);
  assert.equal(r.target.model, MODELS.SONNET_5);
  assert.equal(r.target.effort, 'medium');
});

test('directivesFor builds the three canonical directives', () => {
  const d = directivesFor({ model: MODELS.SONNET_5, effort: 'high', mode: 'plan' });
  assert.deepEqual(d, ['/model claude-sonnet-5', '/effort high', '/plan']);
});
