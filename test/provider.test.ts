import { test } from 'node:test';
import assert from 'node:assert/strict';
import { route, directivesFor } from '../src/router.js';
import { defaultConfig, defaultRouterPolicy, withProvider } from '../src/config.js';
import { CODEX_MODELS, MODELS, PROVIDER_EFFORTS, TIERS } from '../src/constants/models.js';

const codex = () => defaultConfig([], 'codex');

test('the default provider is claude and the ladder is unchanged', () => {
  const cfg = defaultConfig([]);
  assert.equal(cfg.router.provider, 'claude');
  assert.equal(cfg.router.tiers.complex.model, MODELS.OPUS_5);
  assert.equal(route('add a CSV export endpoint').provider, 'claude');
});

test('the codex ladder routes the same tiers to GPT-5.6 models', () => {
  assert.equal(route('fix a typo in the README', codex()).target.model, CODEX_MODELS.LUNA);
  assert.equal(route('add a CSV export endpoint', codex()).target.model, CODEX_MODELS.TERRA);

  const hard = route(
    'design a distributed consensus protocol from scratch, optimize latency across the entire system',
    codex(),
  );
  assert.equal(hard.tier, 'frontier');
  assert.equal(hard.target.model, CODEX_MODELS.SOL);
  assert.ok(['max', 'ultra'].includes(hard.target.effort as string));
});

test('every tier of both ladders emits an effort its provider accepts', () => {
  for (const provider of ['claude', 'codex'] as const) {
    const policy = defaultRouterPolicy(provider);
    for (const tier of TIERS) {
      for (const effort of policy.tiers[tier].efforts) {
        if (effort === null) continue;
        assert.ok(
          PROVIDER_EFFORTS[provider].includes(effort),
          `${provider}/${tier} uses unsupported effort ${effort}`,
        );
      }
    }
  }
});

test('codex directives fold effort into /model and use /approvals for read-only', () => {
  const r = route('run a security audit of the payment flow', codex());
  assert.equal(r.target.mode, 'read-only');
  assert.equal(r.directives[0], `/model ${r.target.model} ${r.target.effort}`);
  assert.ok(r.directives.includes('/approvals read-only'));
  // Claude Code's /effort and /mode commands must not leak into codex output.
  // (note the trailing spaces — `/model ...` itself is a prefix of `/mode`)
  assert.ok(!r.directives.some((d) => d.startsWith('/effort ') || d.startsWith('/mode ')));
});

test('codex results carry a runnable command line; claude results do not', () => {
  const r = route('run a security audit of the payment flow', codex());
  assert.equal(
    r.invocation,
    `codex -m ${r.target.model} -c model_reasoning_effort="${r.target.effort}" --sandbox read-only`,
  );
  assert.equal(route('run a security audit of the payment flow').invocation, null);
});

test('directivesFor defaults to claude syntax when no provider is given', () => {
  const target = { model: MODELS.SONNET_5, effort: 'high' as const, mode: 'single' as const };
  assert.deepEqual(directivesFor(target), [
    '/model claude-sonnet-5',
    '/effort high',
    '/mode single',
  ]);
});

test('an effort the provider cannot accept is clamped to its top level', () => {
  const cfg = defaultConfig([]); // claude — no `ultra`
  cfg.router.tiers.frontier.efforts = ['ultra', 'ultra'];
  const r = route(
    'design a distributed consensus protocol from scratch, optimize latency across the entire system',
    cfg,
  );
  assert.equal(r.tier, 'frontier');
  assert.equal(r.target.effort, 'max');
});

test('withProvider swaps built-in rungs but preserves a hand-pinned model', () => {
  const policy = defaultRouterPolicy('claude');
  policy.tiers.standard.model = 'my-org/custom-model';
  policy.thresholds.complex = 7;

  const swapped = withProvider(policy, 'codex');
  assert.equal(swapped.provider, 'codex');
  assert.equal(swapped.tiers.simple.model, CODEX_MODELS.LUNA);
  assert.equal(swapped.tiers.complex.model, CODEX_MODELS.SOL);
  assert.equal(swapped.tiers.standard.model, 'my-org/custom-model'); // untouched
  assert.equal(swapped.thresholds.complex, 7); // thresholds are provider-agnostic
});

test('escalation names the effort, so a repeated model still reads as a step up', () => {
  // A low-confidence security prompt sits at `complex`; on the codex ladder the
  // next rung is the same model at a higher effort.
  const r = route('audit the payment flow for security vulnerabilities', codex());
  assert.ok(r.escalation);
  assert.equal(r.escalation.tier, 'frontier');
  assert.equal(r.escalation.model, r.target.model); // sol → sol
  assert.equal(r.escalation.effort, 'ultra');
  assert.notEqual(r.escalation.effort, r.target.effort);
});

test('withProvider is a no-op when the provider already matches', () => {
  const policy = defaultRouterPolicy('codex');
  assert.equal(withProvider(policy, 'codex'), policy);
});
