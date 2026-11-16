import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTurn, sweepStudySessions } from '../../src/handlers/practice.js';
import { WIDGET_HTML } from '../../src/services/session/widgetHtml.js';
import { WIDGET_CAPTION } from '../../src/services/session/widgetApi.js';
import { logger } from '../../src/util/logger.js';

type Call = [string, Record<string, unknown>];

function fakeApi(rawOver: Record<string, (p: Record<string, unknown>) => Promise<unknown>> = {}) {
  const calls: Call[] = [];
  const raw = {
    sendWidget: async (p: Record<string, unknown>) => { calls.push(['sendWidget', p]); return { message_id: 500 }; },
    editMessageWidgetData: async (p: Record<string, unknown>) => { calls.push(['editWidget', p]); return true; },
    ...rawOver,
  };
  const api = {
    raw,
    sendMessage: async (_chat: number, text: string) => { calls.push(['sendMessage', { text }]); return { message_id: 600 }; },
    editMessageText: async (_chat: number, _id: number, text: string) => { calls.push(['editText', { text }]); return true; },
    deleteMessage: async () => true,
  };
  return { api: api as never, calls };
}

function fakeDeps(expired: unknown[] = []) {
  const writes: unknown[] = [];
  const sessions = {
    setMessages: async (_id: unknown, m: unknown) => { writes.push(m); },
    setCardKind: async (_id: unknown, kind: string) => { writes.push({ cardKind: kind }); },
  };
  const study = { deps: { sessions }, expireStale: async () => expired };
  return { deps: { study, logger } as never, writes };
}

const turn = (session: Record<string, unknown>) =>
  ({
    session: { _id: 'sid', chatId: 100, ...session },
    view: { text: 'TEXT CARD', buttons: [], finished: false },
    widget: '{"k":"intro"}',
  }) as never;

const tgError = (description: string) => Object.assign(new Error(description), { description });

test('widget session: the first card is sent as a widget and its id stored', async () => {
  const { api, calls } = fakeApi();
  const { deps, writes } = fakeDeps();
  await applyTurn(api, deps, turn({ cardKind: 'widget' }));
  assert.deepEqual(calls, [['sendWidget', {
    chat_id: 100, html: WIDGET_HTML, chat_data: '{"k":"intro"}', allow_queries: true, caption: WIDGET_CAPTION,
  }]]);
  assert.deepEqual(writes, [{ cardMessageId: 500 }]);
});

test('widget session: later turns edit the widget data in place', async () => {
  const { api, calls } = fakeApi();
  const { deps, writes } = fakeDeps();
  await applyTurn(api, deps, turn({ cardKind: 'widget', cardMessageId: 500 }));
  assert.deepEqual(calls, [['editWidget', { chat_id: 100, message_id: 500, chat_data: '{"k":"intro"}' }]]);
  assert.deepEqual(writes, []);
});

test('widget session: "not modified" is ignored, a deleted card is re-sent', async () => {
  const same = fakeApi({ editMessageWidgetData: async () => { throw tgError('Bad Request: message is not modified'); } });
  const d1 = fakeDeps();
  await applyTurn(same.api, d1.deps, turn({ cardKind: 'widget', cardMessageId: 500 }));
  assert.deepEqual(d1.writes, []);

  const gone = fakeApi({
    editMessageWidgetData: async () => { throw tgError('Bad Request: message to edit not found'); },
    sendWidget: async () => ({ message_id: 501 }),
  });
  const d2 = fakeDeps();
  await applyTurn(gone.api, d2.deps, turn({ cardKind: 'widget', cardMessageId: 500 }));
  assert.deepEqual(d2.writes, [{ cardMessageId: 501 }]);
});

test('widget session: a failed first send falls back to the text card for the session', async () => {
  const { api, calls } = fakeApi({ sendWidget: async () => { throw tgError('Bad Request: method not found'); } });
  const { deps, writes } = fakeDeps();
  await applyTurn(api, deps, turn({ cardKind: 'widget' }));
  assert.deepEqual(calls, [['sendMessage', { text: 'TEXT CARD' }]]);
  assert.deepEqual(writes, [{ cardKind: 'text' }, { cardMessageId: 600 }]);
});

test('text session (and sessions without cardKind) never touch the widget API', async () => {
  const { api, calls } = fakeApi();
  const { deps } = fakeDeps();
  await applyTurn(api, deps, turn({}));
  await applyTurn(api, deps, turn({ cardKind: 'text', cardMessageId: 9 }));
  assert.deepEqual(calls.map((c) => c[0]), ['sendMessage', 'editText']);
});

test('sweeper: expired widget sessions get the finish state, text sessions an edited message', async () => {
  const { api, calls } = fakeApi();
  const expired = [
    { session: { _id: 'a', chatId: 100, cardKind: 'widget', cardMessageId: 500 }, view: { text: 'EXPIRED', buttons: [], finished: true }, widget: '{"k":"finish","ex":1}' },
    { session: { _id: 'b', chatId: 100, cardMessageId: 9 }, view: { text: 'EXPIRED', buttons: [], finished: true }, widget: '{"k":"finish","ex":1}' },
  ];
  const { deps } = fakeDeps(expired);
  assert.equal(await sweepStudySessions(api, deps, 1000), 2);
  assert.deepEqual(calls, [
    ['editWidget', { chat_id: 100, message_id: 500, chat_data: '{"k":"finish","ex":1}' }],
    ['editText', { text: 'EXPIRED' }],
  ]);
});
