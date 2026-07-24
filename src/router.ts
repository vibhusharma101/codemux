/**
 * Router — turns a prompt into a concrete routing decision and the directives
 * to hand to the downstream agent.
 */
import { classifyIntent, type Signals } from './classify.js';
import {
  ROUTER_MATRIX,
  type Intent,
  type Mode,
  type RouteTarget,
} from './constants/models.js';
import type { CodemuxConfig } from './config.js';

export interface RouteResult {
  intent: Intent;
  confidence: number;
  reasons: string[];
  target: RouteTarget;
  /** Agent-facing directives, e.g. `/model claude-sonnet-5`, `/effort high`. */
  directives: string[];
}

/** Map an execution mode to its directive token. */
function modeDirective(mode: Mode): string {
  switch (mode) {
    case 'plan':
      return '/plan';
    case 'single':
      return '/mode single';
    case 'multi-agent':
      return '/mode multi-agent';
    case 'read-only':
      return '/mode read-only';
  }
}

/** Build the ordered directive list for a routing target. */
export function directivesFor(target: RouteTarget): string[] {
  return [
    `/model ${target.model}`,
    `/effort ${target.effort}`,
    modeDirective(target.mode),
  ];
}

/**
 * Route a prompt. Uses the config's router matrix when provided (so user
 * overrides apply), otherwise the built-in defaults.
 */
export function route(
  prompt: string,
  config?: CodemuxConfig,
  signals: Signals = {},
): RouteResult {
  const { intent, confidence, reasons } = classifyIntent(prompt, signals);
  const matrix = config?.router ?? ROUTER_MATRIX;
  const target = matrix[intent];
  return {
    intent,
    confidence,
    reasons,
    target,
    directives: directivesFor(target),
  };
}
