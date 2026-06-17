import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo } from '../../src/db/users.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('upsertByTelegramId creates with defaults', async () => {
  const repo = new UsersRepo();
  const u = await repo.upsertByTelegramId(123);
  assert.equal(u.telegramId, 123);
  assert.equal(u.level, 'A0');
  assert.equal(u.plan, 'free');
});

test('upsertByTelegramId is idempotent', async () => {
  const repo = new UsersRepo();
  await repo.upsertByTelegramId(1);
  await repo.upsertByTelegramId(1);
  const u = await repo.getByTelegramId(1);
  assert.equal(u?.telegramId, 1);
});

test('touchUser preserves plan on subsequent calls', async () => {
  const repo = new UsersRepo();
  await repo.touchUser(42);
  await repo.setPlanPaid(42, { periodEnd: new Date('2026-07-01T00:00:00Z') });
  await repo.touchUser(42);
  const u = await repo.getByTelegramId(42);
  assert.equal(u?.plan, 'paid');
});

test('setPlanPaid sets subscription window', async () => {
  const repo = new UsersRepo();
  await repo.upsertByTelegramId(7);
  const end = new Date('2026-06-21T00:00:00Z');
  await repo.setPlanPaid(7, { periodEnd: end, telegramStarsSubscriptionId: 'sub_x' });
  const u = await repo.getByTelegramId(7);
  assert.equal(u?.plan, 'paid');
  assert.equal(u?.subscriptionStatus, 'active');
  assert.equal(u?.subscriptionPeriodEnd?.toISOString(), end.toISOString());
});
