import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { StudySessionsRepo } from '../../src/db/studySessions.js';
import { UserStatsRepo } from '../../src/db/userStats.js';
import type { Exercise } from '../../src/services/session/types.js';

const ex = (cardId: string): Exercise => ({
  cardId, kind: 'choice', prompt: 'p', options: ['a', 'b'], correctIndex: 0,
  answer: 'a', feedback: {},
});

let repo: StudySessionsRepo;
let stats: UserStatsRepo;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  repo = new StudySessionsRepo();
  stats = new UserStatsRepo();
});

test('create + findActive + abandonActive', async () => {
  await repo.create(1, 100, 'mixed', [ex('c1'), ex('c2')]);
  const s = await repo.findActive(1);
  assert.ok(s);
  assert.equal(s.exercises.length, 2);
  assert.equal(s.phase, 'question');
  await repo.abandonActive(1);
  assert.equal(await repo.findActive(1), null);
});

test('advance increments counters, resets tiles/phase, and guards against races', async () => {
  const s = await repo.create(1, 100, 'mixed', [ex('c1'), ex('c2')]);
  await repo.pushTile(s._id, 3);
  assert.equal(await repo.markWrong(s._id, 'c1', ex('c1')), true);
  assert.equal(await repo.markWrong(s._id, 'c1', ex('c1')), false); // double-tap: phase guard
  let cur = await repo.findActive(1);
  assert.equal(cur!.phase, 'feedback');
  assert.deepEqual(cur!.missed, ['c1']);
  assert.deepEqual(cur!.requeued, ['c1']);
  assert.equal(cur!.exercises.length, 3); // requeued exercise appended once
  assert.equal(await repo.advance(s._id, { correct: false, xp: 0, expectedCurrent: 0 }), true);
  assert.equal(await repo.advance(s._id, { correct: false, xp: 0, expectedCurrent: 0 }), false); // stale cursor
  cur = await repo.findActive(1);
  assert.equal(cur!.current, 1);
  assert.equal(cur!.phase, 'question');
  assert.deepEqual(cur!.builderPicked, []);
  assert.equal(await repo.advance(s._id, { correct: true, xp: 12, expectedCurrent: 1 }), true);
  cur = await repo.findActive(1);
  assert.equal(cur!.correctCount, 1);
  assert.equal(cur!.xpEarned, 12);
});

test('setMessages stores card/audio message ids', async () => {
  const s = await repo.create(1, 100, 'mixed', [ex('c1')]);
  await repo.setMessages(s._id, { cardMessageId: 7, audioMessageId: 8 });
  let cur = await repo.findActive(1);
  assert.equal(cur!.cardMessageId, 7);
  assert.equal(cur!.audioMessageId, 8);
  await repo.setMessages(s._id, { audioMessageId: null });
  cur = await repo.findActive(1);
  assert.equal(cur!.audioMessageId, undefined);
});

test('tile push/pop', async () => {
  const s = await repo.create(1, 100, 'mixed', [ex('c1')]);
  await repo.pushTile(s._id, 2);
  await repo.pushTile(s._id, 0);
  assert.deepEqual((await repo.findActive(1))!.builderPicked, [2, 0]);
  await repo.popTile(s._id);
  assert.deepEqual((await repo.findActive(1))!.builderPicked, [2]);
});

test('complete and findStale', async () => {
  const s = await repo.create(1, 100, 'mixed', [ex('c1')]);
  const stale = await repo.findStale(new Date(Date.now() + 1000));
  assert.equal(stale.length, 1);
  await repo.complete(s._id, 'completed');
  assert.equal(await repo.findActive(1), null);
  assert.equal((await repo.findStale(new Date(Date.now() + 1000))).length, 0);
});

test('userStats addXp upserts and accumulates', async () => {
  assert.equal(await stats.addXp(1, 10), 10);
  assert.equal(await stats.addXp(1, 15), 25);
  assert.equal((await stats.get(1))!.xp, 25);
  assert.equal(await stats.get(2), null);
});
