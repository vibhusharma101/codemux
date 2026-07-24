/**
 * Multi-signal prompt analysis.
 *
 * Rather than mapping keywords straight to a model (which can't tell a trivial
 * "add error handling" from a hard one), this estimates several orthogonal
 * signals — **intent**, a **complexity score**, **risk flags**, **scope**, and
 * **multi-step** structure — and hands them to the router, which applies policy.
 *
 * Deterministic and fast (no network). An optional LLM-judge fallback for
 * genuinely ambiguous prompts is a documented future extension (PLAN §4, F2).
 */
import { DEFAULT_INTENT, INTENTS, type Intent } from './constants/models.js';

/** Optional repo signals that sharpen the estimate. */
export interface Signals {
  /** Number of files the change is expected to touch. */
  fileCount?: number;
  /** Approximate diff size in lines. */
  diffLines?: number;
}

export type RiskFlag = 'security' | 'production';

export interface Analysis {
  intent: Intent;
  /** Estimated difficulty, clamped to [0, 14]. Drives the tier. */
  complexity: number;
  risks: RiskFlag[];
  scopeWide: boolean;
  multiStep: boolean;
  /** Number of explicit step connectors ("and then", ";", …) — independent work. */
  steps: number;
  /** Matched complexity-raising terms (for transparency + confidence). */
  complexityHits: string[];
  /** Matched simplicity-lowering terms. */
  simplicityHits: string[];
  intentHits: string[];
  /** Human-readable explanation of the estimate. */
  reasons: string[];
}

/* ------------------------------------------------------------------ */
/* Keyword banks                                                       */
/* ------------------------------------------------------------------ */

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  security: [
    'security', 'secure', 'audit', 'vulnerability', 'vulnerabilities', 'vuln',
    'exploit', 'owasp', 'pentest', 'threat', 'cve', 'injection', 'xss', 'csrf',
    'auth', 'authentication', 'authorization',
  ],
  architecture: [
    'architecture', 'architect', 'redesign', 'system design', 'rearchitect',
    'greenfield', 'from scratch', 'scaffold a', 'design a', 'design the',
  ],
  refactor: [
    'refactor', 'restructure', 'decouple', 'modularize', 'rewrite', 'overhaul',
    'migrate', 'migration', 'clean up', 'extract',
  ],
  bugfix: [
    'fix', 'bug', 'patch', 'hotfix', 'repair', 'broken', 'crash', 'regression',
    'error', 'exception', 'failing', 'debug', 'root cause',
  ],
  test: ['test', 'tests', 'unit test', 'coverage', 'spec', 'e2e', 'fixture'],
  docs: [
    'docs', 'doc', 'documentation', 'readme', 'comment', 'comments', 'changelog',
    'typo', 'jsdoc', 'docstring', 'wording',
  ],
  feature: [
    'add', 'implement', 'build', 'create', 'feature', 'support', 'introduce',
    'new', 'endpoint', 'component',
  ],
};

/** Tie-break order: more capable / structural intents win ambiguous ties. */
const INTENT_PRIORITY: Intent[] = [
  'security', 'architecture', 'refactor', 'feature', 'bugfix', 'test', 'docs',
];

/** Terms that raise estimated difficulty (+2 each). */
const COMPLEXITY_TERMS = [
  'distributed', 'concurrency', 'concurrent', 'race condition', 'deadlock',
  'threading', 'multithread', 'async', 'parallel', 'algorithm', 'optimize',
  'optimization', 'performance', 'scalability', 'throughput', 'latency',
  'architecture', 'redesign', 'design', 'migrate', 'migration', 'rewrite',
  'overhaul', 'protocol', 'consensus', 'cryptography', 'encryption', 'compiler',
  'parser', 'state machine', 'memory leak', 'end-to-end', 'pipeline',
  'orchestrate', 'rearchitect', 'from scratch',
];

/** Terms that lower estimated difficulty (-2 each). */
const SIMPLICITY_TERMS = [
  'typo', 'rename', 'comment', 'formatting', 'lint', 'whitespace', 'bump',
  'changelog', 'readme', 'spelling', 'wording', 'indent', 'reword', 'one-liner',
  'trivial',
];

/** Wide-scope signals (+2, and biases mode toward multi-agent). */
const SCOPE_TERMS = [
  'entire', 'whole', 'across the', 'codebase', 'system-wide', 'everywhere',
  'all files', 'throughout', 'every module', 'end-to-end',
];

/** Uncertainty / investigation signals (+1 each, capped at +2). */
const UNCERTAINTY_TERMS = [
  'investigate', 'root cause', 'figure out', 'diagnose', 'unknown', 'unclear',
  'not sure', 'why is', 'reproduce', 'intermittent', 'flaky',
];

const RISK_SECURITY_TERMS = [
  'security', 'secure', 'auth', 'authentication', 'authorization', 'vulnerability',
  'vulnerabilities', 'exploit', 'owasp', 'cve', 'injection', 'xss', 'csrf',
  'crypto', 'cryptography', 'password', 'secret', 'token', 'payment', 'pii', 'gdpr',
];

const RISK_PRODUCTION_TERMS = [
  'production', 'deploy', 'release', 'irreversible', 'rollback', 'breaking change',
  'data loss', 'schema change', 'database migration', 'db migration', 'downtime',
];

/* ------------------------------------------------------------------ */
/* Matching helpers                                                    */
/* ------------------------------------------------------------------ */

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Word-boundary, case-insensitive occurrence count. */
function countMatches(text: string, term: string): number {
  const re = new RegExp(`\\b${escapeRegExp(term)}\\b`, 'gi');
  return (text.match(re) ?? []).length;
}

function anyMatch(text: string, terms: string[]): string[] {
  return terms.filter((t) => countMatches(text, t) > 0);
}

/* ------------------------------------------------------------------ */
/* Analysis                                                            */
/* ------------------------------------------------------------------ */

const COMPLEXITY_MAX = 14;

/** Analyze a prompt into orthogonal routing signals. */
export function analyze(prompt: string, signals: Signals = {}): Analysis {
  const text = (prompt ?? '').toLowerCase();
  const reasons: string[] = [];

  // --- intent (keyword scoring + priority tie-break) ---
  const intentScores: Record<Intent, number> = {
    docs: 0, test: 0, bugfix: 0, feature: 0, refactor: 0, architecture: 0, security: 0,
  };
  const intentHitMap: Record<Intent, string[]> = {
    docs: [], test: [], bugfix: [], feature: [], refactor: [], architecture: [], security: [],
  };
  for (const intent of INTENTS) {
    for (const kw of INTENT_KEYWORDS[intent]) {
      const n = countMatches(text, kw);
      if (n > 0) {
        intentScores[intent] += n;
        intentHitMap[intent].push(kw);
      }
    }
  }
  let intent: Intent = DEFAULT_INTENT;
  let best = -1;
  for (const cand of INTENT_PRIORITY) {
    if (intentScores[cand] > best) {
      best = intentScores[cand];
      intent = cand;
    }
  }
  if (best <= 0) intent = DEFAULT_INTENT;

  // --- complexity score ---
  let complexity = 0;

  const complexityHits = anyMatch(text, COMPLEXITY_TERMS);
  complexity += complexityHits.length * 2;

  const simplicityHits = anyMatch(text, SIMPLICITY_TERMS);
  complexity -= simplicityHits.length * 2;

  const scopeHits = anyMatch(text, SCOPE_TERMS);
  const scopeWide = scopeHits.length > 0;
  if (scopeWide) {
    complexity += 2;
    reasons.push(`wide scope (${scopeHits.slice(0, 2).join(', ')}) → +complexity`);
  }

  const uncertaintyHits = anyMatch(text, UNCERTAINTY_TERMS);
  if (uncertaintyHits.length) {
    const bump = Math.min(2, uncertaintyHits.length);
    complexity += bump;
    reasons.push(`investigation required (${uncertaintyHits[0]}) → +${bump}`);
  }

  // multi-step structure: connectors and imperative chaining
  const connectors = (text.match(/\b(and then|then|also|afterwards|followed by)\b|;/gi) ?? []).length;
  const multiStep = connectors >= 1;
  if (multiStep) {
    const bump = Math.min(3, connectors);
    complexity += bump;
    reasons.push(`multi-step request (${connectors} connector${connectors > 1 ? 's' : ''}) → +${bump}`);
  }

  // repo signals
  const { fileCount, diffLines } = signals;
  if (fileCount !== undefined) {
    if (fileCount >= 20) {
      complexity += 4;
      reasons.push(`${fileCount} files touched → +4`);
    } else if (fileCount >= 10) {
      complexity += 2;
      reasons.push(`${fileCount} files touched → +2`);
    } else if (fileCount <= 1) {
      complexity -= 1;
      reasons.push('single-file change → -1');
    }
  }
  if (diffLines !== undefined) {
    if (diffLines >= 800) {
      complexity += 3;
      reasons.push(`~${diffLines} diff lines → +3`);
    } else if (diffLines >= 300) {
      complexity += 2;
      reasons.push(`~${diffLines} diff lines → +2`);
    } else if (diffLines <= 20 && diffLines > 0) {
      complexity -= 1;
      reasons.push('tiny diff → -1');
    }
  }

  if (complexityHits.length) {
    reasons.unshift(`complexity signals: ${complexityHits.slice(0, 4).join(', ')}`);
  }
  if (simplicityHits.length) {
    reasons.push(`simplicity signals: ${simplicityHits.slice(0, 4).join(', ')}`);
  }

  complexity = Math.max(0, Math.min(COMPLEXITY_MAX, complexity));

  // --- risk flags ---
  const risks: RiskFlag[] = [];
  const secHits = anyMatch(text, RISK_SECURITY_TERMS);
  if (secHits.length) {
    risks.push('security');
    reasons.push(`security-sensitive (${secHits.slice(0, 2).join(', ')})`);
  }
  const prodHits = anyMatch(text, RISK_PRODUCTION_TERMS);
  if (prodHits.length) {
    risks.push('production');
    reasons.push(`production-risk (${prodHits.slice(0, 2).join(', ')})`);
  }

  return {
    intent,
    complexity,
    risks,
    scopeWide,
    multiStep,
    steps: connectors,
    complexityHits,
    simplicityHits,
    intentHits: intentHitMap[intent],
    reasons,
  };
}
