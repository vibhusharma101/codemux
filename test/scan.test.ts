import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { scanText, mask, SECRET_RULES } from '../src/scan.js';
import { runScan } from '../src/commands/scan.js';
import { tempRepo } from './helpers.js';

// Built at runtime so the literal token never sits in the source file.
const FAKE_GH = 'ghp_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
const FAKE_AWS = 'AKIA' + 'IOSFODNN7EXAMPLE';

test('mask hides the middle of a secret', () => {
  assert.equal(mask('ghp_abcdefgh'), 'ghp_****gh');
  assert.equal(mask('short'), 's****');
});

test('scanText finds a github token and reports masked', () => {
  const findings = scanText(`const t = "${FAKE_GH}";`, 'a.ts');
  assert.equal(findings.length, 1);
  assert.equal(findings[0]!.rule, 'github-token');
  assert.equal(findings[0]!.line, 1);
  assert.ok(!findings[0]!.match.includes(FAKE_GH.slice(4, -2)));
});

test('scanText finds an AWS access key id', () => {
  const findings = scanText(`aws_key=${FAKE_AWS}`);
  assert.ok(findings.some((f) => f.rule === 'aws-access-key-id'));
});

test('scanText is clean on ordinary code', () => {
  assert.deepEqual(scanText('const x = 42;\nfunction f() {}'), []);
});

test('every rule has a name and regex', () => {
  for (const r of SECRET_RULES) {
    assert.ok(r.name.length > 0);
    assert.ok(r.re instanceof RegExp);
  }
});

test('runScan exits 1 and lists findings for a file with a secret', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const p = join(dir, 'leak.env');
    writeFileSync(p, `TOKEN=${FAKE_GH}\n`);
    const out = runScan(dir, { files: [p] });
    assert.equal(out.exitCode, 1);
    assert.match(out.text, /potential secret/);
  } finally {
    cleanup();
  }
});

test('runScan exits 0 on clean files', () => {
  const { dir, cleanup } = tempRepo();
  try {
    const p = join(dir, 'clean.ts');
    writeFileSync(p, 'export const answer = 42;\n');
    const out = runScan(dir, { files: [p] });
    assert.equal(out.exitCode, 0);
  } finally {
    cleanup();
  }
});
