/**
 * Config schema, defaults, and loader for `.kodemux/config.json`.
 *
 * The router is policy-driven: a capability ladder of tiers, complexity
 * thresholds that pick the tier, and a risk floor. Every knob is overridable.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  DEFAULT_PROVIDER,
  PROVIDERS,
  TIER_SPECS_BY_PROVIDER,
  TIERS,
  type Effort,
  type ModelId,
  type Provider,
  type Tier,
} from './constants/models.js';

export const CONFIG_DIR = '.kodemux';
export const CONFIG_FILE = 'config.json';
export const CONFIG_VERSION = 4;

export interface TierPolicy {
  model: ModelId;
  /** [base, boosted] effort; null = no effort directive (e.g. Haiku). */
  efforts: [Effort | null, Effort | null];
}

export interface RouterPolicy {
  /**
   * Which coding agent the directives are written for. Only changes the models
   * on the ladder and the directive syntax — thresholds, floors, escalation and
   * caps are provider-agnostic.
   */
  provider: Provider;
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
  /**
   * When the deterministic pass is unsure (confidence below
   * `escalateBelowConfidence`), consult a cheap AI judge (Haiku) using
   * whatever Anthropic credentials are already configured, before falling
   * back to the deterministic escalation cascade. On by default; failures
   * (no credentials, network, timeout) always fall back silently.
   */
  aiAssist: boolean;
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

export interface KodemuxConfig {
  version: number;
  stack: string[];
  router: RouterPolicy;
  hooks: HookConfig;
}

/** Built-in router policy for a provider, derived from that provider's ladder. */
export function defaultRouterPolicy(provider: Provider = DEFAULT_PROVIDER): RouterPolicy {
  const specs = TIER_SPECS_BY_PROVIDER[provider];
  const tiers = {} as Record<Tier, TierPolicy>;
  for (const t of TIERS) {
    tiers[t] = { model: specs[t].model, efforts: [...specs[t].efforts] };
  }
  return {
    provider,
    tiers,
    thresholds: { standard: 2, complex: 5, frontier: 9 },
    riskFloor: 'complex',
    escalateBelowConfidence: 0.6,
    aiAssist: true,
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
export function defaultConfig(
  stack: string[],
  provider: Provider = DEFAULT_PROVIDER,
): KodemuxConfig {
  return {
    version: CONFIG_VERSION,
    stack,
    router: defaultRouterPolicy(provider),
    hooks: {
      pre: {
        secretsScan: true,
        branchProtection: ['main', 'master', 'production'],
      },
      post: { format: true, lint: true, scopedTests: true },
    },
  };
}

/**
 * Retarget a policy at a different provider, for a single invocation
 * (`kodemux route --provider codex`) without touching the persisted config.
 *
 * Only rungs still sitting on the *current* provider's built-in model are
 * swapped — a tier a developer deliberately pinned to some other model is left
 * alone, so `--provider` never silently discards a hand-written override.
 * Everything else (thresholds, floors, criticalPaths, aiAssist) is
 * provider-agnostic and carries over untouched.
 */
export function withProvider(policy: RouterPolicy, provider: Provider): RouterPolicy {
  if (policy.provider === provider) return policy;
  const from = TIER_SPECS_BY_PROVIDER[policy.provider];
  const to = TIER_SPECS_BY_PROVIDER[provider];
  const tiers = {} as Record<Tier, TierPolicy>;
  for (const t of TIERS) {
    tiers[t] =
      policy.tiers[t].model === from[t].model
        ? { model: to[t].model, efforts: [...to[t].efforts] }
        : policy.tiers[t];
  }
  return { ...policy, provider, tiers };
}

export function configPath(cwd: string): string {
  return join(cwd, CONFIG_DIR, CONFIG_FILE);
}

/**
 * Load and normalize `.kodemux/config.json`. Missing fields fall back to
 * defaults, so a partial hand-edited config stays valid. Throws a readable
 * error if the file is present but not valid JSON.
 */
export function loadConfig(cwd: string): KodemuxConfig | null {
  const path = configPath(cwd);
  if (!existsSync(path)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid JSON in ${path}: ${msg}`);
  }

  const parsed = (raw ?? {}) as Partial<KodemuxConfig>;
  const pr = (parsed.router ?? {}) as Partial<RouterPolicy>;
  // The provider selects which built-in ladder the tier defaults come from, so
  // it has to be resolved before the base config is built.
  const provider = PROVIDERS.includes(pr.provider as Provider)
    ? (pr.provider as Provider)
    : DEFAULT_PROVIDER;
  const base = defaultConfig(parsed.stack ?? [], provider);

  // Deep-merge each tier so a partial override (e.g. just `model`) keeps the
  // base `efforts` instead of dropping it — a shallow spread here would leave
  // `efforts` undefined and crash the router.
  const prTiers = (pr.tiers ?? {}) as Partial<Record<Tier, Partial<TierPolicy>>>;
  const tiers = {} as Record<Tier, TierPolicy>;
  for (const t of TIERS) {
    tiers[t] = { ...base.router.tiers[t], ...(prTiers[t] ?? {}) };
  }

  return {
    version: parsed.version ?? base.version,
    stack: parsed.stack ?? base.stack,
    router: {
      provider,
      tiers,
      thresholds: { ...base.router.thresholds, ...(pr.thresholds ?? {}) },
      riskFloor: pr.riskFloor ?? base.router.riskFloor,
      escalateBelowConfidence:
        pr.escalateBelowConfidence ?? base.router.escalateBelowConfidence,
      criticalPaths: pr.criticalPaths ?? base.router.criticalPaths,
      aiAssist: pr.aiAssist ?? base.router.aiAssist,
    },
    hooks: {
      pre: { ...base.hooks.pre, ...(parsed.hooks?.pre ?? {}) },
      post: { ...base.hooks.post, ...(parsed.hooks?.post ?? {}) },
    },
  };
}
