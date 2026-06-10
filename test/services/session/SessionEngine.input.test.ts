import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../../helpers/mongoMemory.js';
import { SessionEngine, type SpeakJudge } from '../../../src/services/session/SessionEngine.js';
import { StudySessionsRepo, StudySessionModel } from '../../../src/db/studySessions.js';
import { QuizProgressRepo } from '../../../src/db/quizProgress.js';
import { UserStatsRepo } from '../../../src/db/userStats.js';
import { UsersRepo } from '../../../src/db/users.js';
import { QuizEngine } from '../../../src/services/quiz/QuizEngine.js';
import { logger } from '../../../src/util/logger.js';
import type { Exercise } from '../../../src/services/session/types.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', '..', 'fixtures', 'quiz');

let sessions: StudySessionsRepo;
let stats: UserStatsRepo;
let judge: SpeakJudge | null = null;

function makeEngine(quizEngine: QuizEngine): SessionEngine {
  return new SessionEngine({
    engine: quizEngine, sessions, progress: new QuizProgressRepo(),
    stats, users: new UsersRepo(), judge, logger,
  });
}

/** seed an active session with a single hand-built exercise */
async function seed(ex: Exercise) {
  const s = await sessions.create(1, 100, 'mixed', [ex]);
  return s._id.toString();
}

let eng: SessionEngine;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  sessions = new StudySessionsRepo();
  stats = new UserStatsRepo();
  judge = null;
  eng = makeEngine(await QuizEngine.load(fixtures));
  await new UsersRepo().touchUser(1, { defaultLocale: 'en' });
});

const builderEx: Exercise = {
  cardId: 'm1-0001', kind: 'builder', prompt: '🧱 Build: "I want to eat"',
  tiles: ['makan', 'Saya', 'mau'], answer: 'Saya mau makan', feedback: {},
};

test('builder: tapping all tiles in the right order completes correctly', async () => {
  const sid = await seed(builderEx);
  await eng.tapTile(1, sid, 1, true);  // Saya
  await eng.tapTile(1, sid, 2, true);  // mau
  const out = await eng.tapTile(1, sid, 0, true); // makan → complete
  assert.ok(out!.view.finished); // single-exercise session → finish screen
  assert.equal((await stats.get(1))!.xp, 15 + 25); // builder xp + bonus
});

test('builder: wrong order ends in feedback, undo works before completion', async () => {
  const sid = await seed(builderEx);
  await eng.tapTile(1, sid, 0, true);            // makan (wrong start)
  const undone = await eng.undoTile(1, sid, true);
  assert.ok(!undone!.view.text.includes('makan ')); // tile back on the keyboard
  await eng.tapTile(1, sid, 0, true);
  await eng.tapTile(1, sid, 1, true);
  const out = await eng.tapTile(1, sid, 2, true);
  assert.ok(out!.view.text.includes('❌'));
});

test('typed answer: close match counts correct with corrected flash', async () => {
  await seed({
    cardId: 'm1-0001', kind: 'type', prompt: '✍️ "to eat"', answer: 'makan', feedback: {},
  });
  const out = await eng.submitTyped(1, 'makam', true);
  assert.ok(out);
  assert.ok(out.view.finished);
  assert.equal((await stats.get(1))!.xp, 17 + 25);
});

test('typed input returns null when current exercise is not type/speak', async () => {
  await seed(builderEx);
  assert.equal(await eng.submitTyped(1, 'whatever', true), null);
});

test('typed input also accepted for speak exercises (Deepgram-failure fallback)', async () => {
  await seed({
    cardId: 'm1-0001', kind: 'speak', prompt: '🎤 "to eat"', answer: 'makan', feedback: {},
  });
  const out = await eng.submitTyped(1, 'makan', true);
  assert.ok(out!.view.finished);
  assert.equal((await stats.get(1))!.xp, 20 + 25); // xp still scored as speak
});

test('spoken: judge rescues a non-matching transcript', async () => {
  judge = { judgeSpokenAnswer: async () => true };
  eng = makeEngine(await QuizEngine.load(fixtures));
  await seed({
    cardId: 'm1-0001', kind: 'speak', prompt: '🎤 "to eat"', answer: 'makan', feedback: {},
  });
  const out = await eng.submitSpoken(1, 'saya mau makan sekarang', true);
  assert.ok(out!.view.finished);
  assert.equal((await stats.get(1))!.xp, 20 + 25);
});

test('spoken: judge failure falls back to strict (wrong) with note', async () => {
  judge = { judgeSpokenAnswer: async () => { throw new Error('api down'); } };
  eng = makeEngine(await QuizEngine.load(fixtures));
  await seed({
    cardId: 'm1-0001', kind: 'speak', prompt: '🎤 "to eat"', answer: 'makan', feedback: {},
  });
  const out = await eng.submitSpoken(1, 'selamat pagi', true);
  assert.ok(out!.view.text.includes('❌'));
});

test('expireStale finalizes idle sessions', async () => {
  const sid = await seed(builderEx);
  await StudySessionModel.updateOne({}, { $set: { updatedAt: new Date(Date.now() - 60 * 60 * 1000) } }, { timestamps: false });
  const expired = await eng.expireStale(30 * 60 * 1000);
  assert.equal(expired.length, 1);
  assert.equal(expired[0]!.session._id.toString(), sid);
  assert.ok(expired[0]!.view.text.includes('⌛'));
  assert.equal(await sessions.findActive(1), null);
});
