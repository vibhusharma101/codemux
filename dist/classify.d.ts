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
import { type Intent } from './constants/models.js';
/** Optional repo signals that sharpen the estimate. */
export interface Signals {
    /** Number of files the change is expected to touch. */
    fileCount?: number;
    /** Approximate diff size in lines. */
    diffLines?: number;
    /** Repo-relative paths of changed files (for critical-path detection). */
    paths?: string[];
}
export type RiskFlag = 'security' | 'production' | 'critical';
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
/** Analyze a prompt into orthogonal routing signals. */
export declare function analyze(prompt: string, signals?: Signals): Analysis;
