import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { userPromptSubmitHook, preToolUseHook, isCommitCommand } from '../src/hook-adapters.js';
import { runGit } from '../src/git.js';
import { tempRepo } from './helpers.js';

/** A tempRepo() with git initialized, checked out on `branch`, and one commit. */
function gitRepo(branch: string): { dir: string; cleanup: () => void } {
  const { dir, cleanup } = tempRepo();
  runGit(dir, ['init', '-b', branch]);
  runGit(dir, ['config', 'user.email', 'test@example.com']);
  runGit(dir, ['config', 'user.name', 'Test']);
  writeFileSync(join(dir, 'README.md'), '# test\n');
  runGit(dir, ['add', '.']);
  runGit(dir, ['commit', '-m', 'init']);
  return { dir, cleanup };
}

// --- isCommitCommand ---

test('isCommitCommand matches plain and chained git commit invocations', () => {
  assert.ok(isCommitCommand('git commit -m "x"'));
  assert.ok(isCommitCommand('cd foo && git commit -m "x"'));
  assert.ok(isCommitCommand('git add . && git commit'));
  assert.ok(isCommitCommand('git status; git commit -am "x"'));
});

test('isCommitCommand ignores unrelated git and non-commit commands', () => {
  assert.equal(isCommitCommand('git status'), false);
  assert.equal(isCommitCommand('git commitment'), false);
  assert.equal(isCommitCommand('echo "git commit"'), false);
});

// --- userPromptSubmitHook ---

test('userPromptSubmitHook is a no-op on an empty prompt', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const result = await userPromptSubmitHook({ cwd: dir, prompt: '   ' });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stdout, undefined);
  } finally {
    cleanup();
  }
});

test('userPromptSubmitHook injects a routing recommendation as additionalContext', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const result = await userPromptSubmitHook({ cwd: dir, prompt: 'fix a typo in the docs' });
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout);
    const parsed = JSON.parse(result.stdout!);
    assert.equal(parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
    assert.match(parsed.hookSpecificOutput.additionalContext, /kodemux routing recommendation/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /tier .* model .* effort .* mode/);
  } finally {
    cleanup();
  }
});

test('userPromptSubmitHook always states the agent count, even for single-agent mode', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const result = await userPromptSubmitHook({ cwd: dir, prompt: 'fix a typo in the README' });
    const parsed = JSON.parse(result.stdout!);
    assert.match(parsed.hookSpecificOutput.additionalContext, /agents: 1 — do not parallelize/);
  } finally {
    cleanup();
  }
});

test('userPromptSubmitHook recommends fanning out for genuinely parallelizable work', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const result = await userPromptSubmitHook({
      cwd: dir,
      prompt:
        'rewrite the entire distributed architecture across the whole codebase, then migrate the data pipeline, then add tests',
    });
    const parsed = JSON.parse(result.stdout!);
    assert.match(parsed.hookSpecificOutput.additionalContext, /mode multi-agent/);
    assert.match(parsed.hookSpecificOutput.additionalContext, /agents: \d+ — genuinely parallelizable/);
  } finally {
    cleanup();
  }
});

test('userPromptSubmitHook flags low confidence for a thin/ambiguous prompt', async () => {
  const { dir, cleanup } = tempRepo();
  try {
    const result = await userPromptSubmitHook({
      cwd: dir,
      prompt: 'touch the concurrency thing but keep it a small rename',
    });
    const parsed = JSON.parse(result.stdout!);
    assert.match(parsed.hookSpecificOutput.additionalContext, /confidence .* deterministic signal is thin/);
  } finally {
    cleanup();
  }
});

// --- preToolUseHook ---

test('preToolUseHook ignores non-Bash tools', async () => {
  const result = await preToolUseHook({ tool_name: 'Edit', tool_input: { file_path: 'a.ts' } });
  assert.equal(result.exitCode, 0);
});

test('preToolUseHook ignores Bash commands that are not a commit', async () => {
  const result = await preToolUseHook({ tool_name: 'Bash', tool_input: { command: 'npm test' } });
  assert.equal(result.exitCode, 0);
});

test('preToolUseHook blocks a commit on a protected branch', async () => {
  const { dir, cleanup } = gitRepo('main');
  try {
    const result = await preToolUseHook({
      cwd: dir,
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "x"' },
    });
    assert.equal(result.exitCode, 2);
    const decision = JSON.parse(result.stderr!);
    assert.equal(decision.decision, 'block');
    assert.match(decision.reason, /kodemux guard/);
  } finally {
    cleanup();
  }
});

test('preToolUseHook blocks a commit when a secret is staged', async () => {
  const { dir, cleanup } = gitRepo('feat/thing');
  try {
    writeFileSync(join(dir, 'leak.env'), 'TOKEN=' + 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8\n');
    const result = await preToolUseHook({
      cwd: dir,
      tool_name: 'Bash',
      tool_input: { command: 'git commit -am "x"' },
    });
    assert.equal(result.exitCode, 2);
    const decision = JSON.parse(result.stderr!);
    assert.match(decision.reason, /kodemux scan/);
  } finally {
    cleanup();
  }
});

test('preToolUseHook allows a commit on a clean feature branch', async () => {
  const { dir, cleanup } = gitRepo('feat/thing');
  try {
    const result = await preToolUseHook({
      cwd: dir,
      tool_name: 'Bash',
      tool_input: { command: 'git commit -m "x" --allow-empty' },
    });
    assert.equal(result.exitCode, 0);
    assert.equal(result.stderr, undefined);
  } finally {
    cleanup();
  }
});
