import type { KodemuxConfig } from './config.js';
export interface PostStep {
    kind: 'format' | 'lint' | 'test';
    tool: string;
    /** The command to run (files appended for format/lint). */
    command: string;
    files: string[];
}
/**
 * Build the scoped post-hook plan. Groups changed files by language and emits
 * format/lint steps for the touched files plus a single test step per language,
 * gated by the config's post-hook flags.
 */
export declare function planPost(files: string[], config: KodemuxConfig): PostStep[];
