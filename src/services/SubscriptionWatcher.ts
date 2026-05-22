import { UserModel } from '../db/users.js';

export async function expireDueSubscriptions(now: Date = new Date()): Promise<number> {
  const res = await UserModel.updateMany(
    {
      plan: 'paid',
      subscriptionStatus: 'active',
      subscriptionPeriodEnd: { $lt: now },
    },
    { $set: { plan: 'free', subscriptionStatus: 'expired' } },
  );
  return res.modifiedCount;
}
