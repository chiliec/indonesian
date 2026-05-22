import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UserModel, UsersRepo } from '../../src/db/users.js';
import { QuotaModel } from '../../src/db/quotas.js';
import { Entitlement } from '../../src/services/Entitlement.js';
import { QuotaService } from '../../src/services/QuotaService.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  await UserModel.deleteMany({});
  await QuotaModel.deleteMany({});
});

test('paid user always entitled, quota not consumed', async () => {
  await UserModel.create({
    telegramId: 1,
    plan: 'paid',
    subscriptionPeriodEnd: new Date(Date.now() + 1e7),
    subscriptionStatus: 'active',
  });
  const ent = new Entitlement({ users: new UsersRepo(), quota: new QuotaService() });
  const r = await ent.canStartScenario(1, new Date());
  assert.equal(r.allowed, true);
  assert.equal(r.reason, 'paid');
  const quotas = await QuotaModel.find({ telegramId: 1 }).lean();
  assert.equal(quotas.length, 0);
});

test('free user first start today allowed', async () => {
  await UserModel.create({ telegramId: 2, plan: 'free' });
  const ent = new Entitlement({ users: new UsersRepo(), quota: new QuotaService() });
  const r = await ent.canStartScenario(2, new Date());
  assert.equal(r.allowed, true);
  assert.equal(r.reason, 'free-quota');
});

test('free user second start same UTC day blocked', async () => {
  await UserModel.create({ telegramId: 3, plan: 'free' });
  const ent = new Entitlement({ users: new UsersRepo(), quota: new QuotaService() });
  const now = new Date('2026-05-21T10:00:00Z');
  await ent.canStartScenario(3, now);
  const r = await ent.canStartScenario(3, new Date('2026-05-21T22:00:00Z'));
  assert.equal(r.allowed, false);
  assert.equal(r.reason, 'free-exhausted');
});

test('expired paid user falls back to free quota', async () => {
  await UserModel.create({
    telegramId: 4,
    plan: 'paid',
    subscriptionPeriodEnd: new Date(Date.now() - 1000),
    subscriptionStatus: 'expired',
  });
  const ent = new Entitlement({ users: new UsersRepo(), quota: new QuotaService() });
  const r = await ent.canStartScenario(4, new Date());
  assert.equal(r.allowed, true);
  assert.equal(r.reason, 'free-quota');
});
