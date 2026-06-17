import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo, UserModel } from '../../src/db/users.js';

let repo: UsersRepo;
before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  repo = new UsersRepo();
});

test('dailySentenceOptOut defaults unset (enabled) and toggles', async () => {
  await repo.touchUser(1);
  assert.equal((await repo.getByTelegramId(1))!.dailySentenceOptOut ?? false, false);
  await repo.setDailySentenceOptOut(1, true);
  assert.equal((await repo.getByTelegramId(1))!.dailySentenceOptOut, true);
});

test('recordDailySentenceSent persists sentAt and seen IDs', async () => {
  await repo.touchUser(1);
  const at = new Date('2026-06-17T08:00:00Z');
  await repo.recordDailySentenceSent(1, at, ['s1', 's2']);
  const u = (await repo.getByTelegramId(1))!;
  assert.equal(u.lastDailySentenceAt!.toISOString(), at.toISOString());
  assert.deepEqual(u.seenSentenceIds, ['s1', 's2']);
});

test('findDailySentenceCandidates filters opt-out, dormant, and already-sent-today', async () => {
  const now = new Date('2026-06-17T12:00:00Z');
  const dayStart = new Date('2026-06-17T00:00:00Z');
  const activeSince = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // eligible: active, not opted out, never sent
  await UserModel.create({ telegramId: 1, locale: 'en', lastSeenAt: new Date('2026-06-16T09:00:00Z') });
  // opted out
  await UserModel.create({ telegramId: 2, locale: 'en', lastSeenAt: now, dailySentenceOptOut: true });
  // dormant (>14d)
  await UserModel.create({ telegramId: 3, locale: 'en', lastSeenAt: new Date('2026-05-01T09:00:00Z') });
  // already sent today
  await UserModel.create({ telegramId: 4, locale: 'en', lastSeenAt: now, lastDailySentenceAt: new Date('2026-06-17T06:00:00Z') });
  // sent yesterday → eligible again
  await UserModel.create({ telegramId: 5, locale: 'en', lastSeenAt: now, lastDailySentenceAt: new Date('2026-06-16T06:00:00Z') });

  const found = await repo.findDailySentenceCandidates({ activeSince, dayStart });
  const ids = found.map((u) => u.telegramId).sort((a, b) => a - b);
  assert.deepEqual(ids, [1, 5]);
});
