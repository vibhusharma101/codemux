import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runRoute } from '../src/commands/route.js';
import type { JudgeOutcome } from '../src/ai-judge.js';
import { tempRepo } from './helpers.js';

// `git: false` and `ai: false` keep these hermetic — git auto-detection and the
// real AI judge are exercised separately (git.test.ts / ai-judge.test.ts /
// the injected-judge tests below).

test('runRoute errors on empty prompt', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(dir, '   ', { git: false, ai: false });
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /prompt is required/);
  } finally {
    cleanup();
  }
});

test('runRoute prints tier, complexity, and directives', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(dir, 'redesign the distributed architecture', {
      git: false,
      ai: false,
    });
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /complexity/);
    assert.match(out.text, /tier/);
    assert.match(out.text, /\/model claude-/);
  } finally {
    cleanup();
  }
});

test('runRoute --json emits a parseable decision', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(dir, 'add a new feature', { json: true, git: false, ai: false });
    const parsed = JSON.parse(out.text);
    assert.ok(parsed.tier);
    assert.equal(typeof parsed.confidence, 'number');
    assert.ok(Array.isArray(parsed.directives));
    assert.equal(parsed.detected, null); // git disabled
    assert.deepEqual(parsed.aiAssist, { attempted: false, applied: false }); // ai disabled
  } finally {
    cleanup();
  }
});

test('runRoute honors --files/--diff-lines overrides', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(dir, 'update things', {
      files: '30',
      diffLines: '900',
      json: true,
      git: false,
      ai: false,
    });
    const parsed = JSON.parse(out.text);
    assert.ok(['complex', 'frontier'].includes(parsed.tier));
  } finally {
    cleanup();
  }
});

test('runRoute shows n/a effort for the Haiku (simple) tier', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(dir, 'fix a typo in the docs', { git: false, ai: false });
    assert.match(out.text, /effort +n\/a/);
  } finally {
    cleanup();
  }
});

test('runRoute always states the agent count, even for single-agent mode', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(dir, 'fix a typo in the docs', { git: false, ai: false });
    assert.match(out.text, /agents +1 +\(single agent — do not parallelize\)/);
  } finally {
    cleanup();
  }
});

test('runRoute recommends fanning out for genuinely parallelizable work', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = await runRoute(
      dir,
      'rewrite the entire distributed architecture across the whole codebase, then migrate the data pipeline, then add tests',
      { git: false, ai: false },
    );
    assert.match(out.text, /mode +multi-agent/);
    assert.match(out.text, /agents +\d+ +\(parallelize — independent workstreams\)/);
  } finally {
    cleanup();
  }
});

// --- AI-assist orchestration (injected judge — no real network) ---

test('a confident deterministic result never calls the judge', async () => {
  const { dir, cleanup } = tempRepo();
  let called = false;
  try {
    const fakeJudge = async (): Promise<JudgeOutcome> => {
      called = true;
      return { ok: true, result: { complexity: 14, risks: [], rationale: 'should not run' } };
    };
    await runRoute(dir, 'fix a typo in the README', { git: false }, { judge: fakeJudge });
    assert.equal(called, false);
  } finally {
    cleanup();
  }
});

test('a low-confidence result consults the judge and applies its complexity', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const fakeJudge = async (): Promise<JudgeOutcome> => ({
      ok: true,
      result: { complexity: 12, risks: ['security'], rationale: 'touches auth internals' },
    });
    // ambiguous, low-signal prompt -> deterministic confidence starts low
    const out = await runRoute(
      dir,
      'touch the concurrency thing but keep it a small rename',
      { git: false, json: true },
      { judge: fakeJudge },
    );
    const parsed = JSON.parse(out.text);
    assert.equal(parsed.aiAssisted, true);
    assert.ok(parsed.risks.includes('security'));
    assert.equal(parsed.aiAssist.applied, true);
    assert.equal(parsed.aiAssist.complexity, 12);
  } finally {
    cleanup();
  }
});

test('a failed judge call falls back to the deterministic result without throwing', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const fakeJudge = async (): Promise<JudgeOutcome> => ({
      ok: false,
      reason: 'no Anthropic credentials available',
    });
    const out = await runRoute(
      dir,
      'touch the concurrency thing but keep it a small rename',
      { git: false, json: true },
      { judge: fakeJudge },
    );
    const parsed = JSON.parse(out.text);
    assert.equal(parsed.aiAssisted, false);
    assert.equal(parsed.aiAssist.attempted, true);
    assert.equal(parsed.aiAssist.applied, false);
  } finally {
    cleanup();
  }
});

test('--no-ai skips the judge even on a low-confidence route', async () => {
  const { dir, cleanup } = tempRepo();
  let called = false;
  try {
    const fakeJudge = async (): Promise<JudgeOutcome> => {
      called = true;
      return { ok: true, result: { complexity: 14, risks: [], rationale: 'x' } };
    };
    await runRoute(
      dir,
      'touch the concurrency thing but keep it a small rename',
      { git: false, ai: false },
      { judge: fakeJudge },
    );
    assert.equal(called, false);
  } finally {
    cleanup();
  }
});
