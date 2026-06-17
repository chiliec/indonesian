import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo } from '../../src/db/users.js';
import { DailySentenceService } from '../../src/services/DailySentenceService.js';
import type { QuizEngine } from '../../src/services/quiz/QuizEngine.js';
import { sentenceCommand, dailyAnotherCallback } from '../../src/handlers/dailySentence.js';

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
  await repo.touchUser(1, { defaultLocale: 'en' });
});

test('sentenceCommand replies with a sentence and persists seen IDs', async () => {
  const replies: string[] = [];
  const ctx = {
    from: { id: 1 },
    chat: { id: 1 },
    userIsEn: true,
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
    userIsEn: true,
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
