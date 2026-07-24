import { type KodemuxConfig } from '../config.js';
export interface InitOptions {
    /** Overwrite an existing config. */
    force?: boolean;
}
export interface InitResult {
    config: KodemuxConfig;
    created: string[];
    skipped: string[];
}
/**
 * Scaffold `.kodemux/` at `cwd`. Idempotent unless `force` is set: an existing
 * config is left untouched and reported under `skipped`.
 */
export declare function init(cwd: string, opts?: InitOptions): InitResult;
