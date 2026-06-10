import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSessionCallback, editCardSafe } from '../../src/handlers/practice.js';

test('parseSessionCallback parses the s: protocol', () => {
  const sid = 'a'.repeat(24);
  assert.deepEqual(parseSessionCallback(`s:${sid}:a:2`), { sid, op: 'a', arg: 2 });
  assert.deepEqual(parseSessionCallback(`s:${sid}:t:11`), { sid, op: 't', arg: 11 });
  assert.deepEqual(parseSessionCallback(`s:${sid}:u`), { sid, op: 'u', arg: null });
  assert.deepEqual(parseSessionCallback(`s:${sid}:n`), { sid, op: 'n', arg: null });
  assert.equal(parseSessionCallback('s:short:a:1'), null);
  assert.equal(parseSessionCallback('quiz:start:x'), null);
});

test('editCardSafe ignores "message is not modified" and resends on "message to edit not found"', async () => {
  const calls: string[] = [];
  const api = {
    editMessageText: async () => {
      calls.push('edit');
      const e = new Error('Bad Request: message is not modified') as Error & { description?: string };
      e.description = 'Bad Request: message is not modified';
      throw e;
    },
    sendMessage: async () => {
      calls.push('send');
      return { message_id: 42 };
    },
  };
  const r1 = await editCardSafe(api as never, 1, 2, 'text', undefined);
  assert.equal(r1, 2); // unchanged message id
  const api2 = {
    editMessageText: async () => {
      const e = new Error('Bad Request: message to edit not found') as Error & { description?: string };
      e.description = 'Bad Request: message to edit not found';
      throw e;
    },
    sendMessage: async () => ({ message_id: 42 }),
  };
  const r2 = await editCardSafe(api2 as never, 1, 2, 'text', undefined);
  assert.equal(r2, 42); // resent → new message id
  assert.deepEqual(calls, ['edit']);
});
