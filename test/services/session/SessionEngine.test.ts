// test/services/session/SessionEngine.test.ts
import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../../helpers/mongoMemory.js';
import { QuizEngine } from '../../../src/services/quiz/QuizEngine.js';
import { SessionEngine } from '../../../src/services/session/SessionEngine.js';
import { StudySessionsRepo } from '../../../src/db/studySessions.js';
import { QuizProgressRepo } from '../../../src/db/quizProgress.js';
import { UserStatsRepo } from '../../../src/db/userStats.js';
import { UsersRepo } from '../../../src/db/users.js';
import { logger } from '../../../src/util/logger.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', '..', 'fixtures', 'quiz');

let eng: SessionEngine;
let sessions: StudySessionsRepo;
let stats: UserStatsRepo;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  const quizEngine = await QuizEngine.load(fixtures);
  sessions = new StudySessionsRepo();
  stats = new UserStatsRepo();
  const users = new UsersRepo();
  await users.touchUser(1);
  eng = new SessionEngine({
    engine: quizEngine, sessions, progress: new QuizProgressRepo(),
    stats, users, judge: null, logger,
  });
});

test('start creates an active session and renders the first question', async () => {
  const r = await eng.start(1, 100, 'mixed', () => 0.5);
  assert.ok(r);
  assert.equal(r.view.finished, false);
  assert.ok(r.view.text.includes('1/7')); // fixtures have 7 cards total
  const s = await sessions.findActive(1);
  assert.ok(s);
  // fresh user → every exercise is a choice
  assert.ok(s.exercises.every((e) => e.kind === 'choice'));
});

test('correct choice answer advances with flash and awards xp', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  const s = (await sessions.findActive(1))!;
  const ex = s.exercises[0]!;
  const out = await eng.submitChoice(1, s._id.toString(), ex.correctIndex!);
  assert.ok(out);
  assert.ok(out.view.text.includes('✅ Benar! +10 XP'));
  assert.ok(out.view.text.includes('2/7'));
  assert.equal((await stats.get(1))!.xp, 10);
});

test('wrong choice answer shows feedback and requeues the card once', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  const s = (await sessions.findActive(1))!;
  const ex = s.exercises[0]!;
  const wrongIdx = ex.correctIndex === 0 ? 1 : 0;
  const out = await eng.submitChoice(1, s._id.toString(), wrongIdx);
  assert.ok(out!.view.text.includes('❌'));
  assert.ok(out!.view.buttons[0]![0]!.data.endsWith(':n'));
  const after = (await sessions.findActive(1))!;
  assert.equal(after.exercises.length, 8);   // 7 + 1 requeue
  assert.deepEqual(after.requeued, [ex.cardId]);
  // next from feedback advances without xp
  const next = await eng.next(1, s._id.toString());
  assert.ok(next!.view.text.includes('2/8'));
  assert.equal((await stats.get(1)) ?? null, null); // no xp for wrong
});

test('stale session id returns null', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  assert.equal(await eng.submitChoice(1, 'f'.repeat(24), 0), null);
});

test('finishing the last question completes with bonus and review list', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  let s = (await sessions.findActive(1))!;
  let out = null;
  for (let i = 0; i < s.exercises.length; i++) {
    s = (await sessions.findActive(1))!;
    const ex = s.exercises[s.current]!;
    out = await eng.submitChoice(1, s._id.toString(), ex.correctIndex!);
  }
  assert.ok(out!.view.finished);
  assert.ok(out!.view.text.includes('7/7'));
  // 7 × 10 + 25 bonus
  assert.equal((await stats.get(1))!.xp, 95);
  assert.equal(await sessions.findActive(1), null);
});

test('start abandons a prior active session', async () => {
  const a = await eng.start(1, 100, 'mixed', () => 0.5);
  await eng.start(1, 100, 'mixed', () => 0.5);
  const all = await sessions.findActive(1);
  assert.notEqual(all!._id.toString(), a!.session._id.toString());
});
