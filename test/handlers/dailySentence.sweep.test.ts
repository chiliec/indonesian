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

test('dailyAnotherCallback edits the message in place', async () => {
  const edits: { id: number; text: string }[] = [];
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    deps: { usersRepo: repo, dailySentence: svc },
    callbackQuery: { message: { message_id: 99 } },
    answerCallbackQuery: async () => {},
    api: {
      editMessageText: async (_chat: number, id: number, text: string) => { edits.push({ id, text }); },
      sendMessage: async () => ({ message_id: 1 }),
    },
  } as never;
  await dailyAnotherCallback(ctx);
  assert.equal(edits.length, 1);
  assert.equal(edits[0]!.id, 99);
  assert.match(edits[0]!.text, /Saya makan\./);
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
