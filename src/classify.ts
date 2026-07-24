/**
 * Rule-based intent classifier. Maps a free-text prompt (plus optional repo
 * signals) to one of the {@link Intent} categories. Deterministic and fast —
 * no network calls. An LLM fallback for genuinely ambiguous prompts is a
 * documented future extension (PLAN §4, F2).
 */
import { DEFAULT_INTENT, INTENTS, type Intent } from './constants/models.js';

/** Optional repo signals that sharpen classification. */
export interface Signals {
  /** Number of files the change is expected to touch. */
  fileCount?: number;
  /** Approximate diff size in lines. */
  diffLines?: number;
}

export interface ClassifyResult {
  intent: Intent;
  /** 0..1 — share of total keyword weight captured by the winning intent. */
  confidence: number;
  /** Human-readable reasons the winner was chosen (keywords + heuristics). */
  reasons: string[];
}

/** Keyword sets per intent. Matched case-insensitively on word boundaries. */
const KEYWORDS: Record<Intent, string[]> = {
  security: [
    'security', 'secure', 'audit', 'vulnerability', 'vulnerabilities', 'vuln',
    'exploit', 'owasp', 'pentest', 'threat', 'cve', 'injection', 'xss', 'csrf',
  ],
  architecture: [
    'architecture', 'architect', 'refactor', 'redesign', 'migrate', 'migration',
    'rewrite', 'overhaul', 'restructure', 'large-scale', 'system design',
    'decouple', 'modularize',
  ],
  bugfix: [
    'fix', 'bug', 'patch', 'hotfix', 'repair', 'broken', 'crash', 'regression',
    'error', 'exception', 'failing',
  ],
  docs: [
    'docs', 'doc', 'documentation', 'readme', 'comment', 'comments', 'changelog',
    'typo', 'test', 'tests', 'unit test', 'jsdoc', 'docstring',
  ],
  feature: [
    'add', 'implement', 'build', 'create', 'feature', 'support', 'introduce',
    'new', 'endpoint', 'component',
  ],
};

/**
 * Tie-break priority (first wins). More cautious / higher-capability intents
 * are preferred when scores are equal, so ambiguity errs toward more review.
 */
const PRIORITY: Intent[] = ['security', 'architecture', 'feature', 'bugfix', 'docs'];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function countMatches(text: string, keyword: string): number {
  const re = new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'gi');
  return (text.match(re) ?? []).length;
}

/** Classify a prompt into an {@link Intent}. */
export function classifyIntent(prompt: string, signals: Signals = {}): ClassifyResult {
  const text = prompt.toLowerCase();
  const scores: Record<Intent, number> = {
    security: 0, architecture: 0, bugfix: 0, docs: 0, feature: 0,
  };
  const hits: Record<Intent, string[]> = {
    security: [], architecture: [], bugfix: [], docs: [], feature: [],
  };

  for (const intent of INTENTS) {
    for (const kw of KEYWORDS[intent]) {
      const n = countMatches(text, kw);
      if (n > 0) {
        scores[intent] += n;
        hits[intent].push(kw);
      }
    }
  }

  const reasons: string[] = [];

  // Heuristic adjustments from repo signals.
  const { fileCount, diffLines } = signals;
  if ((fileCount ?? 0) >= 10 || (diffLines ?? 0) >= 500) {
    scores.architecture += 2;
    reasons.push(`large change (${fileCount ?? '?'} files / ${diffLines ?? '?'} lines) → +architecture`);
  }
  if (fileCount !== undefined && fileCount <= 1 && (diffLines ?? 0) <= 20 && scores.bugfix > 0) {
    scores.bugfix += 1;
    reasons.push('small, single-file change → +bugfix');
  }

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  // Pick the highest score, breaking ties by PRIORITY.
  let winner: Intent = DEFAULT_INTENT;
  let best = -1;
  for (const intent of PRIORITY) {
    if (scores[intent] > best) {
      best = scores[intent];
      winner = intent;
    }
  }

  if (total === 0) {
    return {
      intent: DEFAULT_INTENT,
      confidence: 0,
      reasons: ['no keywords matched — defaulting to feature'],
    };
  }

  if (hits[winner].length) {
    reasons.unshift(`matched ${winner} keywords: ${hits[winner].join(', ')}`);
  }

  return {
    intent: winner,
    confidence: Number((scores[winner] / total).toFixed(2)),
    reasons,
  };
}
