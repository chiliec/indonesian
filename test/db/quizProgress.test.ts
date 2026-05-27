import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { QuizProgressRepo } from '../../src/db/quizProgress.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('record upserts and increments counters', async () => {
  const repo = new QuizProgressRepo();
  await repo.record(1, 'm1-0001', true);
  await repo.record(1, 'm1-0001', false);
  const map = await repo.forCards(1, ['m1-0001']);
  const p = map.get('m1-0001')!;
  assert.equal(p.seen, 2);
  assert.equal(p.correct, 1);
  assert.equal(p.wrong, 1);
  assert.equal(p.lastResult, 'wrong');
});

test('forCards returns only requested cards for the user', async () => {
  const repo = new QuizProgressRepo();
  await repo.record(1, 'a', true);
  await repo.record(2, 'a', true); // other user
  const map = await repo.forCards(1, ['a', 'b']);
  assert.equal(map.size, 1);
  assert.ok(map.has('a'));
});
