#!/usr/bin/env node
/**
 * codemux CLI entry point.
 */
import { createRequire } from 'node:module';
import { Command } from 'commander';
import { init } from './commands/init.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const program = new Command();

program
  .name('codemux')
  .description('Repo-native middleware & guardrail engine for AI coding tools')
  .version(pkg.version, '-v, --version');

program
  .command('init')
  .description('Detect the repo stack and scaffold .codemux/')
  .option('-f, --force', 'overwrite an existing config', false)
  .action((opts: { force: boolean }) => {
    const result = init(process.cwd(), { force: opts.force });
    const stack = result.config.stack.length
      ? result.config.stack.join(', ')
      : 'none detected';
    console.log(`Detected stack: ${stack}`);
    for (const f of result.created) console.log(`  created  ${f}`);
    for (const f of result.skipped) console.log(`  skipped  ${f}`);
    console.log('\nEdit .codemux/config.json to override routing or hooks.');
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error(`codemux: ${msg}`);
  process.exitCode = 1;
});
