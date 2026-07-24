import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { detectStack } from '../src/detect.js';
import { tempRepo } from './helpers.js';

test('detects an empty repo as no stack', () => {
  const { dir, cleanup } = tempRepo();
  try {
    assert.deepEqual(detectStack(dir), []);
  } finally {
    cleanup();
  }
});

test('detects node + typescript from marker files', () => {
  const { dir, cleanup } = tempRepo();
  try {
    writeFileSync(join(dir, 'package.json'), '{}');
    writeFileSync(join(dir, 'tsconfig.json'), '{}');
    const stacks = detectStack(dir);
    assert.ok(stacks.includes('node'));
    assert.ok(stacks.includes('typescript'));
  } finally {
    cleanup();
  }
});

test('detects python via any of its markers', () => {
  const { dir, cleanup } = tempRepo();
  try {
    writeFileSync(join(dir, 'requirements.txt'), 'flask\n');
    assert.deepEqual(detectStack(dir), ['python']);
  } finally {
    cleanup();
  }
});

test('detects docker and monorepo', () => {
  const { dir, cleanup } = tempRepo();
  try {
    writeFileSync(join(dir, 'Dockerfile'), 'FROM node');
    writeFileSync(join(dir, 'turbo.json'), '{}');
    const stacks = detectStack(dir);
    assert.ok(stacks.includes('docker'));
    assert.ok(stacks.includes('monorepo'));
  } finally {
    cleanup();
  }
});
