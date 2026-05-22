import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo } from '../helpers/mongoMemory.js';
import { SessionsRepo, SessionModel } from '../../src/db/sessions.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => { await SessionModel.deleteMany({}); });

test('createSession persists scenario + turn[0]=assistant opener', async () => {
  const repo = new SessionsRepo();
  const s = await repo.create({
    telegramId: 999,
    scenarioId: 'ojek-to-canggu',
    opener: 'Halo! Mau ke mana, bos?',
  });
  assert.equal(s.status, 'active');
  assert.equal(s.turns.length, 1);
  assert.equal(s.turns[0]?.role, 'assistant');
  assert.equal(s.turns[0]?.text, 'Halo! Mau ke mana, bos?');
});

test('appendTurn pushes a user then assistant turn', async () => {
  const repo = new SessionsRepo();
  const s = await repo.create({ telegramId: 999, scenarioId: 'ojek-to-canggu', opener: 'Halo!' });
  await repo.appendTurn(s._id, { role: 'user', text: 'Mau ke Canggu' });
  await repo.appendTurn(s._id, { role: 'assistant', text: 'Berapa orang?' });
  const fresh = await repo.findById(s._id);
  assert.equal(fresh!.turns.length, 3);
  assert.equal(fresh!.turns[1]?.role, 'user');
  assert.equal(fresh!.turns[2]?.text, 'Berapa orang?');
});

test('findActive returns latest active session for user', async () => {
  const repo = new SessionsRepo();
  await repo.create({ telegramId: 7, scenarioId: 'ojek-to-canggu', opener: 'a' });
  const newer = await repo.create({ telegramId: 7, scenarioId: 'ojek-to-canggu', opener: 'b' });
  const active = await repo.findActive(7);
  assert.equal(active!._id.toString(), newer._id.toString());
});

test('endSession sets status=ended + endedAt', async () => {
  const repo = new SessionsRepo();
  const s = await repo.create({ telegramId: 7, scenarioId: 'ojek-to-canggu', opener: 'a' });
  await repo.endSession(s._id, 'user');
  const fresh = await repo.findById(s._id);
  assert.equal(fresh!.status, 'ended');
  assert.equal(fresh!.endReason, 'user');
  assert.ok(fresh!.endedAt);
});
