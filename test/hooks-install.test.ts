import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { installHooks } from '../src/commands/hooks-install.js';
import { tempRepo } from './helpers.js';

test('installHooks scaffolds .claude/settings.json with both hook groups', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const out = installHooks(dir);
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /registered in/);

    const settingsFile = join(dir, '.claude', 'settings.json');
    assert.ok(existsSync(settingsFile));
    const settings = JSON.parse(readFileSync(settingsFile, 'utf8'));
    assert.equal(settings.hooks.UserPromptSubmit.length, 1);
    assert.match(settings.hooks.UserPromptSubmit[0].hooks[0].command, /hook user-prompt-submit$/);
    assert.equal(settings.hooks.PreToolUse.length, 1);
    assert.equal(settings.hooks.PreToolUse[0].matcher, 'Bash');
    assert.match(settings.hooks.PreToolUse[0].hooks[0].command, /hook pre-tool-use$/);
  } finally {
    cleanup();
  }
});

test('installHooks is idempotent — running twice does not duplicate entries', () => {
  const { dir, cleanup } = tempRepo();
  try {
    installHooks(dir);
    const second = installHooks(dir);
    assert.match(second.text, /already registered/);

    const settings = JSON.parse(readFileSync(join(dir, '.claude', 'settings.json'), 'utf8'));
    assert.equal(settings.hooks.UserPromptSubmit.length, 1);
    assert.equal(settings.hooks.PreToolUse.length, 1);
  } finally {
    cleanup();
  }
});

test('installHooks merges into an existing settings.json without dropping other hooks', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const claudeDir = join(dir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(
      join(claudeDir, 'settings.json'),
      JSON.stringify({
        otherSetting: true,
        hooks: {
          PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'some-other-tool' }] }],
        },
      }),
    );

    const out = installHooks(dir);
    assert.equal(out.exitCode, 0);
    assert.match(out.text, /backup:/);
    assert.ok(existsSync(join(claudeDir, 'settings.json.bak')));

    const settings = JSON.parse(readFileSync(join(claudeDir, 'settings.json'), 'utf8'));
    assert.equal(settings.otherSetting, true);
    // both the pre-existing entry and kodemux's new one survive, in the same group
    assert.equal(settings.hooks.PreToolUse.length, 2);
    const commands = settings.hooks.PreToolUse.flatMap((g: any) => g.hooks.map((h: any) => h.command));
    assert.ok(commands.includes('some-other-tool'));
    assert.ok(commands.some((c: string) => c.endsWith('hook pre-tool-use')));
  } finally {
    cleanup();
  }
});

test('installHooks refuses to touch an invalid settings.json', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const claudeDir = join(dir, '.claude');
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, 'settings.json'), '{ not valid json');

    const out = installHooks(dir);
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /not valid JSON/);
    // untouched
    assert.equal(readFileSync(join(claudeDir, 'settings.json'), 'utf8'), '{ not valid json');
  } finally {
    cleanup();
  }
});

test('installHooks --global writes to the home directory instead of the project', () => {
  const { dir: fakeHome, cleanup } = tempRepo();
  const { dir: projectDir, cleanup: cleanupProject } = tempRepo();
  const prevHome = process.env.HOME;
  const prevUserProfile = process.env.USERPROFILE;
  process.env.HOME = fakeHome;
  process.env.USERPROFILE = fakeHome;
  try {
    const out = installHooks(projectDir, { global: true });
    assert.equal(out.exitCode, 0);
    assert.ok(existsSync(join(fakeHome, '.claude', 'settings.json')));
    assert.ok(!existsSync(join(projectDir, '.claude', 'settings.json')));
  } finally {
    if (prevHome === undefined) delete process.env.HOME;
    else process.env.HOME = prevHome;
    if (prevUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = prevUserProfile;
    cleanup();
    cleanupProject();
  }
});
