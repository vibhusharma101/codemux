import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchGlob, matchesAny } from '../src/glob.js';

test('**/auth/** matches nested and root-level auth dirs', () => {
  assert.ok(matchGlob('src/auth/session.ts', '**/auth/**'));
  assert.ok(matchGlob('auth/config.ts', '**/auth/**'));
});

test('**/auth/** does not match a lookalike segment', () => {
  assert.ok(!matchGlob('src/myauth/x.ts', '**/auth/**'));
});

test('.env* matches env files at any depth but not lookalikes', () => {
  assert.ok(matchGlob('.env', '.env*'));
  assert.ok(matchGlob('.env.local', '.env*'));
  assert.ok(matchGlob('services/api/.env', '.env*'));
  assert.ok(!matchGlob('environment.ts', '.env*'));
});

test('**/*.tf matches terraform files anywhere', () => {
  assert.ok(matchGlob('infra/main.tf', '**/*.tf'));
  assert.ok(matchGlob('main.tf', '**/*.tf'));
  assert.ok(!matchGlob('main.ts', '**/*.tf'));
});

test('matchesAny is true when any pattern hits', () => {
  const patterns = ['**/auth/**', '**/migrations/**', 'infra/**'];
  assert.ok(matchesAny('db/migrations/001_init.sql', patterns));
  assert.ok(!matchesAny('src/components/Button.tsx', patterns));
});

test('Windows-style backslash paths are normalized', () => {
  assert.ok(matchGlob('src\\auth\\session.ts', '**/auth/**'));
});
