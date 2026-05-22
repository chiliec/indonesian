import type { BotCtx } from '../bot.js';
import { UserModel } from '../db/users.js';
import { SessionModel } from '../db/sessions.js';
import { PaymentModel } from '../db/payments.js';

export function isAdmin(telegramId: number, env: string): boolean {
  if (!env) return false;
  return env
    .split(',')
    .map((s) => Number(s.trim()))
    .includes(telegramId);
}

export async function statsCommand(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !isAdmin(ctx.from.id, ctx.deps.adminIds)) return;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [users, paidUsers, sessions24h, sessionsTotal, payments24h, paymentsTotal] =
    await Promise.all([
      UserModel.countDocuments({}),
      UserModel.countDocuments({ plan: 'paid', subscriptionStatus: 'active' }),
      SessionModel.countDocuments({ startedAt: { $gte: since } }),
      SessionModel.countDocuments({}),
      PaymentModel.countDocuments({ paidAt: { $gte: since } }),
      PaymentModel.countDocuments({}),
    ]);
  await ctx.reply(
    `📊 *Stats*\n` +
      `Users: ${users} (paid active: ${paidUsers})\n` +
      `Sessions 24h / total: ${sessions24h} / ${sessionsTotal}\n` +
      `Payments 24h / total: ${payments24h} / ${paymentsTotal}`,
    { parse_mode: 'Markdown' },
  );
}
