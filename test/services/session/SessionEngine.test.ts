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
import { QuizProgressModel } from '../../../src/db/quizProgress.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', '..', 'fixtures', 'quiz');

let eng: SessionEngine;
let sessions: StudySessionsRepo;
let stats: UserStatsRepo;
let quizEngine: QuizEngine;
let users: UsersRepo;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  quizEngine = await QuizEngine.load(fixtures);
  sessions = new StudySessionsRepo();
  stats = new UserStatsRepo();
  users = new UsersRepo();
  await users.touchUser(1);
  eng = new SessionEngine({
    engine: quizEngine, sessions, progress: new QuizProgressRepo(),
    stats, users, judge: null, logger,
  });
});

/** tap Got it on an intro, or answer the current choice/cloze question correctly */
async function step() {
  const s = (await sessions.findActive(1))!;
  const ex = s.exercises[s.current]!;
  const sid = s._id.toString();
  return ex.kind === 'intro' ? eng.next(1, sid) : eng.submitChoice(1, sid, ex.correctIndex!);
}

test('start: a fresh user gets an intro card first, 5 new words quizzed twice', async () => {
  const r = await eng.start(1, 100, 'mixed', () => 0.5);
  assert.ok(r);
  assert.equal(r.view.finished, false);
  assert.ok(r.view.text.includes('New word'));
  assert.ok(r.view.text.includes('<b>pasar</b> — market'));
  assert.ok(r.view.text.includes('1/10'));
  assert.ok(r.view.buttons[0]![0]!.data.endsWith(':n'));
  assert.equal(r.view.audioFile, 'aaa111.ogg');
  const s = (await sessions.findActive(1))!;
  assert.equal(s.exercises.filter((e) => e.kind === 'intro').length, 5);
  assert.equal(s.exercises.filter((e) => e.kind === 'choice').length, 10);
});

test('intro: Got it advances without xp, progress or question count', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  assert.equal(await eng.submitTyped(1, 'pasar'), null); // typing during an intro is not consumed
  const out = await step();
  assert.ok(out!.view.text.includes('<b>rumah</b> — house'));
  assert.ok(out!.view.text.includes('1/10'));
  assert.equal((await stats.get(1)) ?? null, null);
  assert.equal(await QuizProgressModel.countDocuments({}), 0);
  assert.equal((await sessions.findActive(1))!.correctCount, 0);
});

test('correct choice answer advances with a word-naming flash and awards xp', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  await step(); // intro pasar
  await step(); // intro rumah
  const out = await step(); // quiz pasar
  assert.ok(out);
  assert.ok(out.view.text.includes('✅ pasar — market +10 XP'));
  assert.ok(out.view.text.includes('2/10'));
  assert.equal((await stats.get(1))!.xp, 10);
});

test('wrong choice answer shows feedback with the word and requeues the card once', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  await step();
  await step();
  const s = (await sessions.findActive(1))!;
  const ex = s.exercises[s.current]!;
  const wrongIdx = ex.correctIndex === 0 ? 1 : 0;
  const out = await eng.submitChoice(1, s._id.toString(), wrongIdx);
  assert.ok(out!.view.text.includes('❌'));
  assert.ok(out!.view.text.includes('pasar — market'));
  assert.ok(out!.view.buttons[0]![0]!.data.endsWith(':n'));
  const after = (await sessions.findActive(1))!;
  assert.equal(after.exercises.length, 16);   // 15 + 1 requeue
  assert.deepEqual(after.requeued, [ex.cardId]);
  // next from feedback advances without xp; the requeue counts as a question
  const next = await eng.next(1, s._id.toString());
  assert.ok(next!.view.text.includes('2/11'));
  assert.equal((await stats.get(1)) ?? null, null); // no xp for wrong
});

test('stale session id returns null', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  assert.equal(await eng.submitChoice(1, 'f'.repeat(24), 0), null);
});

test('finishing completes with bonus, question-only total and the new-word list', async () => {
  await eng.start(1, 100, 'mixed', () => 0.5);
  let out = await step();
  for (let i = 0; i < 40 && !out!.view.finished; i++) out = await step();
  assert.ok(out!.view.finished);
  assert.ok(out!.view.text.includes('10/10'));
  assert.ok(out!.view.text.includes('🆕 New: pasar, rumah, air, teman, makan'));
  assert.ok(!out!.view.text.includes('📅')); // each word answered twice → next due in 3 days
  // 10 × 10 + 25 bonus
  assert.equal((await stats.get(1))!.xp, 125);
  assert.equal(await sessions.findActive(1), null);
});

test('returning user: reviews only, and the finish screen counts what is due tomorrow', async () => {
  await users.setSessionLength(1, 5);
  await QuizProgressModel.insertMany(
    quizEngine.allCards().map((c) => ({
      telegramId: 1, cardId: c.id, seen: 1, correct: 1, lastResult: 'correct', lastSeenAt: new Date(),
    })),
  );
  const r = await eng.start(1, 100, 'mixed', () => 0.5);
  assert.ok(r!.view.text.includes('1/5'));
  assert.ok(!r!.view.text.includes('New word'));
  let out = await step();
  for (let i = 0; i < 20 && !out!.view.finished; i++) out = await step();
  assert.ok(out!.view.text.includes('5/5'));
  assert.ok(!out!.view.text.includes('🆕'));
  // 7 cards seen today; 5 just answered again (now 3 days out), 2 still due within a day
  assert.ok(out!.view.text.includes('📅 2 words due tomorrow'));
});

test('start abandons a prior active session', async () => {
  const a = await eng.start(1, 100, 'mixed', () => 0.5);
  await eng.start(1, 100, 'mixed', () => 0.5);
  const all = await sessions.findActive(1);
  assert.notEqual(all!._id.toString(), a!.session._id.toString());
});

test('start: cardKind follows the richCards setting and every turn carries widget state', async () => {
  const plain = await eng.start(1, 100, 'mixed', () => 0.5);
  assert.equal(plain!.session.cardKind, 'text');
  await users.setRichCards(1, true);
  const rich = await eng.start(1, 100, 'mixed', () => 0.5);
  assert.equal(rich!.session.cardKind, 'widget');
  const st = JSON.parse(rich!.widget);
  assert.equal(st.k, 'intro');
  assert.equal(st.q, 0);
  const next = await step();
  assert.equal(JSON.parse(next!.widget).q, 1);
});
