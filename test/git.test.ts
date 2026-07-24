import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePorcelain, parseNumstat } from '../src/git.js';

test('parsePorcelain extracts status and rename destinations', () => {
  const out = ' M src/a.ts\n?? new.ts\nR  old.ts -> src/b.ts\n';
  const files = parsePorcelain(out);
  assert.deepEqual(files.map((f) => f.path), ['src/a.ts', 'new.ts', 'src/b.ts']);
  assert.equal(files[1]!.status, '??');
});

test('parseNumstat sums added + deleted lines across files', () => {
  const out = '10\t2\tsrc/a.ts\n5\t5\tsrc/b.ts\n';
  const stats = parseNumstat(out);
  assert.equal(stats.fileCount, 2);
  assert.equal(stats.diffLines, 22); // 10+2 + 5+5
});

test('parseNumstat treats binary files (- -) as files with 0 lines', () => {
  const out = '-\t-\tlogo.png\n3\t0\tREADME.md\n';
  const stats = parseNumstat(out);
  assert.equal(stats.fileCount, 2);
  assert.equal(stats.diffLines, 3);
});

test('parseNumstat is empty for empty input', () => {
  assert.deepEqual(parseNumstat(''), { fileCount: 0, diffLines: 0 });
});
