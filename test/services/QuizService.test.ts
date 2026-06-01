import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { QuizEngine } from '../../src/services/quiz/QuizEngine.js';
import { QuizService, MIXED_MODULE_ID } from '../../src/services/QuizService.js';
import { QuizSessionsRepo } from '../../src/db/quizSessions.js';
import { QuizProgressRepo } from '../../src/db/quizProgress.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'fixtures', 'quiz');

let svc: QuizService;
let sessions: QuizSessionsRepo;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  const engine = await QuizEngine.load(fixtures);
  sessions = new QuizSessionsRepo();
  svc = new QuizService({ engine, sessions, progress: new QuizProgressRepo() });
});

test('moduleList reports mastery percentages with Mixed first', async () => {
  const list = await svc.moduleList(1);
  // 2 fixture modules + the synthetic Mixed entry, which sorts first.
  assert.equal(list.length, 3);
  assert.equal(list[0]!.id, MIXED_MODULE_ID);
  const m1 = list.find((m) => m.id === 'module-1')!;
  assert.equal(m1.pct, 0);
});

test('start with Mixed draws across all modules', async () => {
  const res = await svc.start(1, MIXED_MODULE_ID);
  assert.ok(res);
  assert.equal(res.session.moduleId, MIXED_MODULE_ID);
  const ids = res.session.questions.map((q) => q.cardId);
  // fixtures have fewer than 10 cards total, so every module's cards appear
  assert.ok(ids.some((id) => id.startsWith('m1-')), 'expected module-1 cards');
  assert.ok(ids.some((id) => id.startsWith('m2-')), 'expected module-2 cards');
});

test('start builds a session capped at module size and returns first question', async () => {
  const res = await svc.start(1, 'module-1');
  assert.ok(res);
  assert.equal(res.session.questions.length, 5); // module-1 has 5 cards (< 10)
  assert.equal(res.first.cardId, res.session.questions[0]!.cardId);
});

test('start returns null for unknown module', async () => {
  assert.equal(await svc.start(1, 'nope'), null);
});

test('start abandons any prior active session', async () => {
  await svc.start(1, 'module-1');
  await svc.start(1, 'module-2');
  const active = await sessions.findActive(1);
  assert.equal(active!.moduleId, 'module-2');
});

test('recordAnswer scores correct answer and advances', async () => {
  const res = await svc.start(1, 'module-1');
  const sess = res!.session;
  const q0 = sess.questions[0]!;
  await sessions.setCurrentPoll(sess._id, 'poll-1');
  const outcome = await svc.recordAnswer('poll-1', q0.correctIndex);
  assert.ok(outcome);
  assert.equal(outcome.correct, true);
  assert.ok(outcome.next); // more questions remain
  assert.equal(outcome.next.index, 1);
});

test('recordAnswer on last question completes session and lists missed', async () => {
  const res = await svc.start(1, 'module-1');
  let sess = res!.session;
  // Answer every question wrong by picking a deliberately wrong index.
  for (let i = 0; i < sess.questions.length; i++) {
    const fresh = await sessions.findActive(1);
    const q = fresh!.questions[fresh!.current]!;
    const wrong = (q.correctIndex + 1) % q.options.length;
    await sessions.setCurrentPoll(fresh!._id, `p-${i}`);
    var outcome = await svc.recordAnswer(`p-${i}`, wrong);
  }
  assert.equal(outcome!.done, true);
  assert.equal(outcome!.finalScore, 0);
  assert.equal(outcome!.total, 5);
  assert.equal(outcome!.missed.length, 5);
  assert.equal(await sessions.findActive(1), null); // completed
});

test('recordAnswer returns null for unknown poll id', async () => {
  assert.equal(await svc.recordAnswer('ghost', 0), null);
});

test('unseen cards are ordered before mastered ones', async () => {
  const progress = new QuizProgressRepo();
  // Master one card; it should sort last.
  await progress.record(1, 'm1-0001', true);
  const res = await svc.start(1, 'module-1');
  const ids = res!.session.questions.map((q) => q.cardId);
  // module-1 has 5 cards; mastered m1-0001 should be at the end.
  assert.equal(ids[ids.length - 1], 'm1-0001');
});

test('mixed answers yield partial score and partial missed list', async () => {
  const res = await svc.start(1, 'module-1');
  const total = res!.session.questions.length;
  let outcome;
  for (let i = 0; i < total; i++) {
    const fresh = await sessions.findActive(1);
    const q = fresh!.questions[fresh!.current]!;
    // first question correct, the rest wrong
    const chosen = i === 0 ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
    await sessions.setCurrentPoll(fresh!._id, `mix-${i}`);
    outcome = await svc.recordAnswer(`mix-${i}`, chosen);
  }
  assert.equal(outcome!.done, true);
  assert.equal(outcome!.finalScore, 1);
  assert.equal(outcome!.total, total);
  assert.equal(outcome!.missed.length, total - 1);
});

test('ordering groups unseen, then previously-wrong, then mastered', async () => {
  const progress = new QuizProgressRepo();
  await progress.record(1, 'm1-0001', true);  // mastered -> last
  await progress.record(1, 'm1-0002', false); // wrong -> middle
  const res = await svc.start(1, 'module-1');
  const ids = res!.session.questions.map((q) => q.cardId);
  const posWrong = ids.indexOf('m1-0002');
  const posMastered = ids.indexOf('m1-0001');
  const unseen = ['m1-0003', 'm1-0004', 'm1-0005'];
  // every unseen card comes before the previously-wrong card
  for (const u of unseen) {
    assert.ok(ids.indexOf(u) < posWrong, `${u} should precede previously-wrong m1-0002`);
  }
  // the previously-wrong card comes before the mastered card
  assert.ok(posWrong < posMastered, 'previously-wrong should precede mastered');
  // mastered card is last
  assert.equal(ids[ids.length - 1], 'm1-0001');
});

test('start: audioless cards always render as text', async () => {
  // m1-0004 ("teman") has no audio in the fixtures.
  const res = await svc.start(1, 'module-1', () => 0);
  const teman = res!.session.questions.find((q) => q.cardId === 'm1-0004')!;
  assert.equal(teman.type, 'text');
  assert.equal(teman.audioFile, undefined);
});

test('start: unmastered audio cards render as listen with audio attached', async () => {
  const res = await svc.start(1, 'module-1', () => 0);
  const pasar = res!.session.questions.find((q) => q.cardId === 'm1-0001')!;
  assert.equal(pasar.type, 'listen');
  assert.equal(pasar.audioFile, 'aaa111.ogg');
});

test('start: a mastered audio card becomes produce when the roll passes', async () => {
  const progress = new QuizProgressRepo();
  await progress.record(1, 'm1-0001', true); // mastered
  // rng=0 makes the produce roll (rng < 1/5) pass for the mastered audio card.
  const res = await svc.start(1, 'module-1', () => 0);
  const pasar = res!.session.questions.find((q) => q.cardId === 'm1-0001')!;
  assert.equal(pasar.type, 'produce');
  assert.equal(pasar.audioFile, undefined);
});
