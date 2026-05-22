import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UserModel } from '../../src/db/users.js';
import { expireDueSubscriptions } from '../../src/services/SubscriptionWatcher.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('expireDueSubscriptions flips active->expired only for past expiry', async () => {
  await UserModel.create({
    telegramId: 1,
    locale: 'en',
    plan: 'paid',
    subscriptionStatus: 'active',
    subscriptionPeriodEnd: new Date(Date.now() - 1000),
  });
  await UserModel.create({
    telegramId: 2,
    locale: 'en',
    plan: 'paid',
    subscriptionStatus: 'active',
    subscriptionPeriodEnd: new Date(Date.now() + 1e9),
  });
  const n = await expireDueSubscriptions();
  assert.equal(n, 1);
  const u1 = await UserModel.findOne({ telegramId: 1 }).lean();
  const u2 = await UserModel.findOne({ telegramId: 2 }).lean();
  assert.equal(u1!.plan, 'free');
  assert.equal(u1!.subscriptionStatus, 'expired');
  assert.equal(u2!.plan, 'paid');
});
