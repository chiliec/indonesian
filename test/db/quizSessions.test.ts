import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { QuizSessionsRepo } from '../../src/db/quizSessions.js';
import type { Question } from '../../src/services/quiz/types.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

function q(cardId: string): Question {
  return {
    cardId,
    type: 'text',
    promptText: 'p',
    options: ['a', 'b', 'c', 'd'],
    correctIndex: 0,
    explanation: 'x = y',
  };
}

test('create stores questions and defaults', async () => {
  const repo = new QuizSessionsRepo();
  const s = await repo.create(7, 'module-1', [q('c1'), q('c2')]);
  assert.equal(s.status, 'active');
  assert.equal(s.current, 0);
  assert.equal(s.score, 0);
  assert.equal(s.questions.length, 2);
});

test('setCurrentPoll + findByPollId round-trips', async () => {
  const repo = new QuizSessionsRepo();
  const s = await repo.create(7, 'module-1', [q('c1')]);
  await repo.setCurrentPoll(s._id, 'poll-abc');
  const found = await repo.findByPollId('poll-abc');
  assert.ok(found);
  assert.equal(found._id.toString(), s._id.toString());
});

test('recordAnswer advances current, scores, clears poll, tracks missed', async () => {
  const repo = new QuizSessionsRepo();
  const s = await repo.create(7, 'module-1', [q('c1'), q('c2')]);
  await repo.setCurrentPoll(s._id, 'p1');
  await repo.recordAnswer(s._id, false, 'c1');
  const after1 = await repo.findByPollId('p1');
  assert.equal(after1, null); // poll cleared
  const fresh = await repo.findActive(7);
  assert.equal(fresh!.current, 1);
  assert.equal(fresh!.score, 0);
  assert.deepEqual(fresh!.missed, ['c1']);
});

test('abandonActive flips active sessions, complete sets completed', async () => {
  const repo = new QuizSessionsRepo();
  const s = await repo.create(7, 'module-1', [q('c1')]);
  await repo.abandonActive(7);
  assert.equal(await repo.findActive(7), null);
  const s2 = await repo.create(7, 'module-1', [q('c1')]);
  await repo.complete(s2._id);
  assert.equal(await repo.findActive(7), null);
});
