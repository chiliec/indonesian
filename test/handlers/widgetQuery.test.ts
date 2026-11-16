import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { QuizEngine } from '../../src/services/quiz/QuizEngine.js';
import { SessionEngine } from '../../src/services/session/SessionEngine.js';
import { StudySessionsRepo } from '../../src/db/studySessions.js';
import { QuizProgressRepo } from '../../src/db/quizProgress.js';
import { UserStatsRepo } from '../../src/db/userStats.js';
import { UsersRepo } from '../../src/db/users.js';
import { xpFor } from '../../src/services/session/xp.js';
import { logger } from '../../src/util/logger.js';
import { applyTurn, handleWidgetQuery, parseWidgetData, practiceHandler } from '../../src/handlers/practice.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'fixtures', 'quiz');

type Call = [string, Record<string, unknown>];
let eng: SessionEngine;
let sessions: StudySessionsRepo;
let stats: UserStatsRepo;
let users: UsersRepo;
let calls: Call[];
let api: never;
let deps: never;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  sessions = new StudySessionsRepo();
  stats = new UserStatsRepo();
  users = new UsersRepo();
  await users.touchUser(1);
  await users.setRichCards(1, true);
  eng = new SessionEngine({
    engine: await QuizEngine.load(fixtures), sessions, progress: new QuizProgressRepo(),
    stats, users, judge: null, logger,
  });
  calls = [];
  let nextId = 500;
  api = {
    raw: {
      sendWidget: async (p: Record<string, unknown>) => { calls.push(['sendWidget', p]); return { message_id: nextId++ }; },
      editMessageWidgetData: async (p: Record<string, unknown>) => { calls.push(['editWidget', p]); return true; },
      answerWidgetQuery: async (p: Record<string, unknown>) => { calls.push(['answer', p]); return true; },
    },
    sendVoice: async () => ({ message_id: 7 }),
    deleteMessage: async () => true,
  } as never;
  deps = {
    study: eng, usersRepo: users, logger,
    audioCache: { get: async () => 'cached-file-id', set: async () => {} },
  } as never;
});

/** start a widget session and put its first card on screen (message id 500) */
async function begin() {
  await applyTurn(api, deps, (await eng.start(1, 100, 'mixed', () => 0.5))!);
  calls.length = 0;
}
const query = (data: string, over: Record<string, unknown> = {}) =>
  ({ id: 'q1', from: { id: 1 }, data, chat: { id: 100 }, message_id: 500, ...over });
const answers = () => calls.filter((c) => c[0] === 'answer').map((c) => c[1].data);
const pushed = () => calls.filter((c) => c[0] === 'editWidget').map((c) => JSON.parse(c[1].chat_data as string));
const current = async () => (await sessions.findActive(1))!;

/** tap Got it until the current exercise is a question */
async function skipIntros() {
  for (let s = await current(); s.exercises[s.current]!.kind === 'intro'; s = await current()) {
    await handleWidgetQuery(api, deps, query(`n:${s.current}`));
  }
  calls.length = 0;
}

test('parseWidgetData parses the request protocol', () => {
  assert.deepEqual(parseWidgetData('a:3:2'), { op: 'a', q: 3, arg: 2 });
  assert.deepEqual(parseWidgetData('b:12:2,0,1'), { op: 'b', q: 12, order: [2, 0, 1] });
  assert.deepEqual(parseWidgetData('n:0'), { op: 'n', q: 0 });
  assert.deepEqual(parseWidgetData('again'), { op: 'again' });
  for (const bad of ['', 'a:1', 'a:x:1', 'b:1:', 'b:1:1,,2', 'n', 'again:1', 's:abc:a:1']) {
    assert.equal(parseWidgetData(bad), null, bad);
  }
});

test('Got it on an intro: answered ok, next card pushed into the same message', async () => {
  await begin();
  await handleWidgetQuery(api, deps, query('n:0'));
  assert.deepEqual(answers(), ['ok']);
  assert.equal(calls[0]![0], 'answer'); // answered before the push
  assert.equal(pushed()[0].q, 1);
  assert.equal(calls.find((c) => c[0] === 'editWidget')![1].message_id, 500);
});

test('a query from a message that is not the session card is expired', async () => {
  await begin();
  await handleWidgetQuery(api, deps, query('n:0', { message_id: 499 }));
  assert.deepEqual(answers(), ['expired']);
  assert.deepEqual(pushed(), []);
  assert.equal((await current()).current, 0);
});

test('a retried tap is not applied to the next card: state is re-pushed, XP counted once', async () => {
  await begin();
  await skipIntros();
  const s = await current();
  const data = `a:${s.current}:${s.exercises[s.current]!.correctIndex}`;
  await handleWidgetQuery(api, deps, query(data));
  await handleWidgetQuery(api, deps, query(data)); // retry after a lost answer
  assert.deepEqual(answers(), ['ok', 'ok']);
  assert.equal((await stats.get(1))!.xp, xpFor('choice'));
  assert.equal((await current()).current, s.current + 1);
  assert.deepEqual(pushed().map((p) => p.q), [s.current + 1, s.current + 1]);
});

test('wrong answer pushes the feedback screen; Next advances', async () => {
  await begin();
  await skipIntros();
  const s = await current();
  const ex = s.exercises[s.current]!;
  const wrong = (ex.correctIndex! + 1) % ex.options!.length;
  await handleWidgetQuery(api, deps, query(`a:${s.current}:${wrong}`));
  assert.equal(pushed()[0].k, 'feedback');
  assert.equal(pushed()[0].a, ex.answer);
  await handleWidgetQuery(api, deps, query(`n:${s.current}`));
  assert.equal((await current()).current, s.current + 1);
  assert.deepEqual(answers(), ['ok', 'ok']);
});

test('malformed data is answered with error and changes nothing', async () => {
  await begin();
  await handleWidgetQuery(api, deps, query('zzz'));
  assert.deepEqual(answers(), ['error']);
  assert.deepEqual(pushed(), []);
});

test('again starts a new session in a new widget message', async () => {
  await begin();
  await sessions.complete((await current())._id, 'completed');
  await handleWidgetQuery(api, deps, query('again'));
  assert.deepEqual(answers(), ['ok']);
  assert.equal(calls.filter((c) => c[0] === 'sendWidget').length, 1);
  assert.equal((await current()).cardMessageId, 501);
});

test('a throwing dependency still gets the query answered', async () => {
  await begin();
  const broken = { ...(deps as Record<string, unknown>), usersRepo: { touchUser: async () => { throw new Error('db down'); } } } as never;
  await handleWidgetQuery(api, broken, query('n:0'));
  assert.deepEqual(answers(), ['error']);
  assert.deepEqual(pushed(), []);
});

test('Practice starts a fresh session when the Rich cards setting changed since the open one', async () => {
  await users.setRichCards(1, false);
  (api as unknown as Record<string, unknown>).sendMessage = async () => ({ message_id: 1 });
  await applyTurn(api, deps, (await eng.start(1, 100, 'mixed', () => 0.5))!); // text session
  await users.setRichCards(1, true);
  const ctx = { from: { id: 1 }, chat: { id: 100 }, api, deps, reply: async () => {} } as never;
  await practiceHandler(ctx);
  assert.equal((await current()).cardKind, 'widget');
  assert.equal(calls.filter((c) => c[0] === 'sendWidget').length, 1);
});
