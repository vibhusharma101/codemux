/**
 * Config schema, defaults, and loader for `.codemux/config.json`.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROUTER_MATRIX,
  type Intent,
  type RouteTarget,
} from './constants/models.js';

export const CONFIG_DIR = '.codemux';
export const CONFIG_FILE = 'config.json';
export const CONFIG_VERSION = 1;

export interface HookConfig {
  pre: {
    /** Scan changes for secret-shaped strings before handing off to the agent. */
    secretsScan: boolean;
    /** Branch names on which direct edits are refused. */
    branchProtection: string[];
  };
  post: {
    format: boolean;
    lint: boolean;
    scopedTests: boolean;
  };
}

export interface CodemuxConfig {
  version: number;
  stack: string[];
  /** Overridable copy of the router matrix. */
  router: Record<Intent, RouteTarget>;
  hooks: HookConfig;
}

/** Build a default config for a freshly detected stack. */
export function defaultConfig(stack: string[]): CodemuxConfig {
  return {
    version: CONFIG_VERSION,
    stack,
    router: structuredClone(ROUTER_MATRIX),
    hooks: {
      pre: {
        secretsScan: true,
        branchProtection: ['main', 'master', 'production'],
      },
      post: {
        format: true,
        lint: true,
        scopedTests: true,
      },
    },
  };
}

/** Absolute path to the config file for a repo root. */
export function configPath(cwd: string): string {
  return join(cwd, CONFIG_DIR, CONFIG_FILE);
}

/**
 * Load and normalize `.codemux/config.json`. Missing router rows or hook
 * fields fall back to defaults, so a partial hand-edited config stays valid.
 * Throws a readable error if the file is present but not valid JSON.
 */
export function loadConfig(cwd: string): CodemuxConfig | null {
  const path = configPath(cwd);
  if (!existsSync(path)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${path}: ${msg}`);
  }

  const parsed = (raw ?? {}) as Partial<CodemuxConfig>;
  const base = defaultConfig(parsed.stack ?? []);
  return {
    version: parsed.version ?? base.version,
    stack: parsed.stack ?? base.stack,
    router: { ...base.router, ...(parsed.router ?? {}) },
    hooks: {
      pre: { ...base.hooks.pre, ...(parsed.hooks?.pre ?? {}) },
      post: { ...base.hooks.post, ...(parsed.hooks?.post ?? {}) },
    },
  };
}
