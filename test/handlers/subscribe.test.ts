import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { PaymentModel } from '../../src/db/payments.js';
import { UserModel, UsersRepo } from '../../src/db/users.js';
import { recordSuccessfulPayment } from '../../src/handlers/subscribe.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('recordSuccessfulPayment is idempotent on telegramChargeId', async () => {
  const users = new UsersRepo();
  await UserModel.create({ telegramId: 1, plan: 'free' });
  await recordSuccessfulPayment({
    telegramId: 1,
    telegramChargeId: 'charge-1',
    starsAmount: 199,
    payload: 'sub:monthly',
    usersRepo: users,
  });
  await recordSuccessfulPayment({
    telegramId: 1,
    telegramChargeId: 'charge-1',
    starsAmount: 199,
    payload: 'sub:monthly',
    usersRepo: users,
  });
  const payments = await PaymentModel.find({ telegramId: 1 });
  assert.equal(payments.length, 1);
});

test('successful payment promotes user to paid + sets expiry +30d', async () => {
  const users = new UsersRepo();
  await UserModel.create({ telegramId: 2, plan: 'free' });
  const now = new Date('2026-05-21T00:00:00Z');
  await recordSuccessfulPayment({
    telegramId: 2,
    telegramChargeId: 'charge-2',
    starsAmount: 199,
    payload: 'sub:monthly',
    usersRepo: users,
    now,
  });
  const u = await UserModel.findOne({ telegramId: 2 }).lean();
  assert.equal(u!.plan, 'paid');
  assert.equal(u!.subscriptionStatus, 'active');
  assert.equal(u!.subscriptionPeriodEnd!.toISOString(), '2026-06-20T00:00:00.000Z');
});
