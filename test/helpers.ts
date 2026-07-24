/** Shared test helpers: throwaway temp directories. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Create a fresh temp dir and return it plus a cleanup fn. */
export function tempRepo(): { dir: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'codemux-test-'));
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}
