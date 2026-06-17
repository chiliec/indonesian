import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo } from '../../src/db/users.js';
import { DailySentenceService } from '../../src/services/DailySentenceService.js';
import type { QuizEngine } from '../../src/services/quiz/QuizEngine.js';
import { sentenceCommand, dailyAnotherCallback, sweepDailySentences } from '../../src/handlers/dailySentence.js';
import { UserModel } from '../../src/db/users.js';

function fakeEngine(): QuizEngine {
  return {
    allCards: () => [
      { id: 'c1', indonesian: 'makan', english: 'eat', sentences: [
        { id: 's1', text: 'Saya makan.', blank: 'makan', en: 'I eat.' },
        { id: 's2', text: 'Dia makan.', blank: 'makan', en: 'He eats.' },
      ] },
    ],
  } as unknown as QuizEngine;
}

let repo: UsersRepo;
let svc: DailySentenceService;
before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  repo = new UsersRepo();
  svc = new DailySentenceService(fakeEngine(), () => 0);
  await repo.touchUser(1);
});

test('sentenceCommand replies with a sentence and persists seen IDs', async () => {
  const replies: string[] = [];
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: svc },
    reply: async (text: string) => { replies.push(text); },
  } as never;
  await sentenceCommand(ctx);
  assert.equal(replies.length, 1);
  assert.match(replies[0]!, /Saya makan\./);
  assert.deepEqual((await repo.getByTelegramId(1))!.seenSentenceIds, ['s1']);
});

test('dailyAnotherCallback sends a new message and drops the old button', async () => {
  const sends: { id: number; text: string }[] = [];
  const markupEdits: number[] = [];
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: svc },
    callbackQuery: { message: { message_id: 99 } },
    answerCallbackQuery: async () => {},
    api: {
      editMessageReplyMarkup: async (_chat: number, id: number) => { markupEdits.push(id); },
      sendMessage: async (id: number, text: string) => { sends.push({ id, text }); return { message_id: 1 }; },
    },
  } as never;
  await dailyAnotherCallback(ctx);
  // old message's button removed
  assert.deepEqual(markupEdits, [99]);
  // a fresh message is sent (not an in-place edit)
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.id, 1);
  assert.match(sends[0]!.text, /Saya makan\./);
});

test('dailyAnotherCallback sends even when dropping the old button fails', async () => {
  const sends: string[] = [];
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: svc },
    callbackQuery: { message: { message_id: 99 } },
    answerCallbackQuery: async () => {},
    api: {
      // Telegram rejects (e.g. message too old to edit) — must not block the new send.
      editMessageReplyMarkup: async () => { throw new Error('message is not modified'); },
      sendMessage: async (_id: number, text: string) => { sends.push(text); return { message_id: 1 }; },
    },
  } as never;
  await dailyAnotherCallback(ctx);
  assert.equal(sends.length, 1);
  assert.match(sends[0]!, /Saya makan\./);
});

test('dailyAnotherCallback persists seen IDs and advances to a fresh sentence', async () => {
  const sends: string[] = [];
  const api = {
    editMessageReplyMarkup: async () => {},
    sendMessage: async (_id: number, text: string) => { sends.push(text); return { message_id: 1 }; },
  };
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: svc },
    callbackQuery: { message: { message_id: 99 } },
    answerCallbackQuery: async () => {},
    api,
  } as never;

  await dailyAnotherCallback(ctx);
  assert.deepEqual((await repo.getByTelegramId(1))!.seenSentenceIds, ['s1']);
  assert.match(sends[0]!, /Saya makan\./);

  await dailyAnotherCallback(ctx);
  // second pick advances past the already-seen sentence (seen list is capped to recent IDs)
  assert.deepEqual((await repo.getByTelegramId(1))!.seenSentenceIds, ['s2']);
  assert.match(sends[1]!, /Dia makan\./);
});

test('dailyAnotherCallback does nothing when the sentence pool is empty', async () => {
  // Engine with no sentences → pick() returns null (rotation can't reset an empty pool).
  const emptySvc = new DailySentenceService(
    { allCards: () => [{ id: 'c1', indonesian: 'makan', english: 'eat', sentences: [] }] } as unknown as QuizEngine,
    () => 0,
  );
  let sent = false;
  let markupEdited = false;
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: emptySvc },
    callbackQuery: { message: { message_id: 99 } },
    answerCallbackQuery: async () => {},
    api: {
      editMessageReplyMarkup: async () => { markupEdited = true; },
      sendMessage: async () => { sent = true; return { message_id: 1 }; },
    },
  } as never;
  await dailyAnotherCallback(ctx);
  assert.equal(sent, false);
  assert.equal(markupEdited, false);
});

test('dailyAnotherCallback returns early without a callback message', async () => {
  let answered = false;
  let sent = false;
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: svc },
    callbackQuery: {}, // no .message
    answerCallbackQuery: async () => { answered = true; },
    api: {
      editMessageReplyMarkup: async () => {},
      sendMessage: async () => { sent = true; return { message_id: 1 }; },
    },
  } as never;
  await dailyAnotherCallback(ctx);
  assert.equal(answered, true); // callback is still acknowledged
  assert.equal(sent, false);
});

test('sweepDailySentences sends to due users, gates on target time, opts out on 403', async () => {
  await clearMemoryMongo();
  // user 1: lastSeen 08:00 → due at 12:00; eligible
  await UserModel.create({ telegramId: 1, locale: 'en', lastSeenAt: new Date('2026-06-17T08:00:00Z') });
  // user 2: lastSeen 20:00 → target 20:00 > now 12:00; NOT yet due
  await UserModel.create({ telegramId: 2, locale: 'en', lastSeenAt: new Date('2026-06-16T20:00:00Z') });
  // user 3: due, but send throws 403 → should be opted out
  await UserModel.create({ telegramId: 3, locale: 'en', lastSeenAt: new Date('2026-06-17T07:00:00Z') });

  const sentTo: number[] = [];
  const api = {
    sendMessage: async (chatId: number) => {
      if (chatId === 3) {
        const e = new Error('Forbidden: bot was blocked by the user') as Error & { error_code?: number };
        e.error_code = 403;
        throw e;
      }
      sentTo.push(chatId);
      return { message_id: 1 };
    },
  };
  const deps = {
    usersRepo: repo,
    dailySentence: svc,
    logger: { info() {}, warn() {}, debug() {}, error() {} },
  };
  const now = new Date('2026-06-17T12:00:00Z');
  const sent = await sweepDailySentences(api as never, deps as never, { now, activeWindowMs: 14 * 24 * 60 * 60 * 1000 });

  assert.equal(sent, 1);
  assert.deepEqual(sentTo, [1]);
  // user 2 not due → no record
  assert.equal((await repo.getByTelegramId(2))!.lastDailySentenceAt ?? null, null);
  // user 3 blocked → opted out
  assert.equal((await repo.getByTelegramId(3))!.dailySentenceOptOut, true);
});
