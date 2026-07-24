import { test } from 'node:test';
import assert from 'node:assert/strict';
import { judgeWithClient, type MinimalAnthropicClient } from '../src/ai-judge.js';

function fakeClient(response: unknown): MinimalAnthropicClient {
  return {
    messages: {
      create: async () => response as Awaited<ReturnType<MinimalAnthropicClient['messages']['create']>>,
    },
  };
}

function textResponse(json: unknown, stop_reason = 'end_turn') {
  return { stop_reason, content: [{ type: 'text', text: JSON.stringify(json) }] };
}

test('parses a well-formed judge response', async () => {
  const client = fakeClient(
    textResponse({ complexity: 8, risks: ['security'], rationale: 'touches auth' }),
  );
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, true);
  if (out.ok) {
    assert.equal(out.result.complexity, 8);
    assert.deepEqual(out.result.risks, ['security']);
    assert.equal(out.result.rationale, 'touches auth');
  }
});

test('extracts the JSON object even when wrapped in prose', async () => {
  const client = fakeClient({
    stop_reason: 'end_turn',
    content: [
      {
        type: 'text',
        text: 'Sure! Here is my assessment:\n{"complexity": 7, "risks": [], "rationale": "moderate"}\nHope that helps.',
      },
    ],
  });
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.result.complexity, 7);
});

test('clamps out-of-range complexity into [0, 14]', async () => {
  const client = fakeClient(textResponse({ complexity: 99, risks: [], rationale: 'x' }));
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, true);
  if (out.ok) assert.equal(out.result.complexity, 14);
});

test('drops unknown risk flags rather than trusting them blindly', async () => {
  const client = fakeClient(
    textResponse({ complexity: 3, risks: ['security', 'made-up-flag'], rationale: 'x' }),
  );
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, true);
  if (out.ok) assert.deepEqual(out.result.risks, ['security']);
});

test('a refusal stop_reason is treated as a clean skip, not a crash', async () => {
  const client = fakeClient(textResponse({}, 'refusal'));
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.reason, /declined/);
});

test('malformed JSON in the response never throws — resolves to ok:false', async () => {
  const client = fakeClient({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'not json{' }] });
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, false);
});

test('a network/client error never throws — resolves to ok:false', async () => {
  const client: MinimalAnthropicClient = {
    messages: {
      create: async () => {
        throw new Error('connect ECONNREFUSED');
      },
    },
  };
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, false);
  if (!out.ok) assert.match(out.reason, /ECONNREFUSED/);
});

test('missing text content resolves to ok:false rather than throwing', async () => {
  const client = fakeClient({ stop_reason: 'end_turn', content: [] });
  const out = await judgeWithClient(client, 'do something');
  assert.equal(out.ok, false);
});
