// test/services/anthropic.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildMessageHistory, AnthropicService } from '../../src/services/anthropic.js';

const logger = null as never;

test('buildMessageHistory maps turns to Anthropic format', () => {
  const turns = [
    { role: 'assistant' as const, text: 'Halo!' },
    { role: 'user' as const, text: 'Hai' },
    { role: 'assistant' as const, text: 'Mau ke mana?' },
  ];
  const messages = buildMessageHistory(turns);
  assert.equal(messages.length, 3);
  assert.equal(messages[0]!.role, 'assistant');
  assert.equal(messages[0]!.content, 'Halo!');
  assert.equal(messages[1]!.role, 'user');
  assert.equal(messages[2]!.role, 'assistant');
});

test('buildMessageHistory truncates to last N turns when given limit', () => {
  const turns = Array.from({ length: 30 }, (_, i) => ({
    role: (i % 2 === 0 ? 'assistant' : 'user') as 'user' | 'assistant',
    text: `t${i}`,
  }));
  const messages = buildMessageHistory(turns, 10);
  assert.equal(messages.length, 10);
  assert.equal(messages[messages.length - 1]!.content, 't29');
});

test('judgeSpokenAnswer returns true on YES and false on NO', async () => {
  const svc = new AnthropicService({ apiKey: 'k', logger });
  (svc as never as { client: { messages: { create: () => Promise<unknown> } } }).client = {
    messages: { create: async () => ({ content: [{ type: 'text', text: 'YES' }] }) },
  } as never;
  assert.equal(await svc.judgeSpokenAnswer('saya mau makan', 'makan'), true);

  (svc as never as { client: { messages: { create: () => Promise<unknown> } } }).client = {
    messages: { create: async () => ({ content: [{ type: 'text', text: 'NO' }] }) },
  } as never;
  assert.equal(await svc.judgeSpokenAnswer('selamat pagi', 'makan'), false);
});
