import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { SessionsRepo, SessionModel } from '../../src/db/sessions.js';
import { sweepStaleSessions } from '../../src/services/SessionSweeper.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('sweepStaleSessions ends sessions older than threshold', async () => {
  await SessionModel.create({
    telegramId: 1,
    scenarioId: 'ojek-to-canggu',
    status: 'active',
    turns: [
      { role: 'assistant', text: 'a', at: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    ],
    startedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
  });
  await SessionModel.create({
    telegramId: 2,
    scenarioId: 'ojek-to-canggu',
    status: 'active',
    turns: [{ role: 'assistant', text: 'b', at: new Date() }],
    startedAt: new Date(),
  });
  const repo = new SessionsRepo();
  const count = await sweepStaleSessions(repo, 24 * 60 * 60 * 1000);
  assert.equal(count, 1);
  const stillActive = await SessionModel.countDocuments({ status: 'active' });
  assert.equal(stillActive, 1);
});
