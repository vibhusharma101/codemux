/**
 * Config schema, defaults, and loader for `.codemux/config.json`.
 *
 * The router is policy-driven: a capability ladder of tiers, complexity
 * thresholds that pick the tier, and a risk floor. Every knob is overridable.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TIER_SPECS,
  TIERS,
  type Effort,
  type ModelId,
  type Tier,
} from './constants/models.js';

export const CONFIG_DIR = '.codemux';
export const CONFIG_FILE = 'config.json';
export const CONFIG_VERSION = 2;

export interface TierPolicy {
  model: ModelId;
  /** [base, boosted] effort; null = no effort directive (e.g. Haiku). */
  efforts: [Effort | null, Effort | null];
}

export interface RouterPolicy {
  /** Model + effort for each rung of the ladder. */
  tiers: Record<Tier, TierPolicy>;
  /**
   * Minimum complexity score to reach each tier above `simple`. A prompt scoring
   * below `standard` routes to `simple`.
   */
  thresholds: { standard: number; complex: number; frontier: number };
  /** Minimum tier when any risk flag (security/production/critical) is present. */
  riskFloor: Tier;
  /** Escalate (recommend the next tier up) when confidence is below this. */
  escalateBelowConfidence: number;
  /**
   * Glob patterns for high-blast-radius paths. A change touching any of these
   * raises a `critical` risk flag and floors the tier — even if the prompt text
   * never mentions it.
   */
  criticalPaths: string[];
}

export interface HookConfig {
  pre: {
    secretsScan: boolean;
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
  router: RouterPolicy;
  hooks: HookConfig;
}

/** Built-in router policy, derived from the tier specs. */
export function defaultRouterPolicy(): RouterPolicy {
  const tiers = {} as Record<Tier, TierPolicy>;
  for (const t of TIERS) {
    tiers[t] = { model: TIER_SPECS[t].model, efforts: [...TIER_SPECS[t].efforts] };
  }
  return {
    tiers,
    thresholds: { standard: 2, complex: 5, frontier: 9 },
    riskFloor: 'complex',
    escalateBelowConfidence: 0.6,
    criticalPaths: [
      '**/auth/**',
      '**/migrations/**',
      'infra/**',
      '.env*',
      '**/secrets/**',
      '**/payment*/**',
      '**/billing/**',
      '**/*.tf',
    ],
  };
}

/** Build a default config for a freshly detected stack. */
export function defaultConfig(stack: string[]): CodemuxConfig {
  return {
    version: CONFIG_VERSION,
    stack,
    router: defaultRouterPolicy(),
    hooks: {
      pre: {
        secretsScan: true,
        branchProtection: ['main', 'master', 'production'],
      },
      post: { format: true, lint: true, scopedTests: true },
    },
  };
}

export function configPath(cwd: string): string {
  return join(cwd, CONFIG_DIR, CONFIG_FILE);
}

/**
 * Load and normalize `.codemux/config.json`. Missing fields fall back to
 * defaults, so a partial hand-edited config stays valid. Throws a readable
 * error if the file is present but not valid JSON.
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
  const pr = (parsed.router ?? {}) as Partial<RouterPolicy>;
  return {
    version: parsed.version ?? base.version,
    stack: parsed.stack ?? base.stack,
    router: {
      tiers: { ...base.router.tiers, ...(pr.tiers ?? {}) },
      thresholds: { ...base.router.thresholds, ...(pr.thresholds ?? {}) },
      riskFloor: pr.riskFloor ?? base.router.riskFloor,
      escalateBelowConfidence:
        pr.escalateBelowConfidence ?? base.router.escalateBelowConfidence,
      criticalPaths: pr.criticalPaths ?? base.router.criticalPaths,
    },
    hooks: {
      pre: { ...base.hooks.pre, ...(parsed.hooks?.pre ?? {}) },
      post: { ...base.hooks.post, ...(parsed.hooks?.post ?? {}) },
    },
  };
}
