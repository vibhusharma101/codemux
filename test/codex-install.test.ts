import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installCodex, upsertBlock, kodemuxBlock } from '../src/commands/codex-install.js';
import { tempRepo } from './helpers.js';

test('installCodex creates AGENTS.md with the routing + guardrail block', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = installCodex(dir);
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /created/);

    const agents = readFileSync(join(dir, 'AGENTS.md'), 'utf8');
    assert.match(agents, /kodemux route "<the task>" --provider codex/);
    assert.match(agents, /kodemux guard/);
    assert.match(agents, /kodemux scan/);
    assert.ok(!existsSync(join(dir, 'AGENTS.md.bak'))); // nothing to back up
  } finally {
    cleanup();
  }
});

test('installCodex preserves existing AGENTS.md content and backs it up', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const path = join(dir, 'AGENTS.md');
    writeFileSync(path, '# House rules\n\nRun `npm test` before committing.\n', 'utf8');

    const out = installCodex(dir);
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /updated/);

    const agents = readFileSync(path, 'utf8');
    assert.match(agents, /# House rules/);
    assert.match(agents, /Run `npm test` before committing\./);
    assert.match(agents, /kodemux route/);
    assert.equal(readFileSync(`${path}.bak`, 'utf8'), '# House rules\n\nRun `npm test` before committing.\n');
  } finally {
    cleanup();
  }
});

test('installCodex is idempotent — running twice does not duplicate the block', () => {
  const { dir, cleanup } = tempRepo();
  try {
    installCodex(dir);
    const first = readFileSync(join(dir, 'AGENTS.md'), 'utf8');

    const out = installCodex(dir);
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /already up to date/);
    assert.equal(readFileSync(join(dir, 'AGENTS.md'), 'utf8'), first);
  } finally {
    cleanup();
  }
});

test('upsertBlock rewrites a stale block in place rather than appending', () => {
  const stale = [
    '# House rules',
    '',
    '<!-- BEGIN kodemux -->',
    'old instructions',
    '<!-- END kodemux -->',
    '',
    'trailing section',
  ].join('\n');

  const next = upsertBlock(stale, kodemuxBlock());
  assert.ok(next);
  assert.ok(!next.includes('old instructions'));
  assert.match(next, /# House rules/);
  assert.match(next, /trailing section/);
  assert.equal(next.match(/BEGIN kodemux/g)?.length, 1);
});

test('upsertBlock returns null when the file already matches', () => {
  assert.equal(upsertBlock(`intro\n\n${kodemuxBlock()}\n`, kodemuxBlock()), null);
});
