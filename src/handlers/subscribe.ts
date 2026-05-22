import type { BotCtx } from '../bot.js';
import { PaymentModel } from '../db/payments.js';
import type { UsersRepo } from '../db/users.js';

const STARS_AMOUNT = 199;
const PAYLOAD = 'sub:monthly';

export async function subscribeCommand(ctx: BotCtx): Promise<void> {
  if (!ctx.chat) return;
  await ctx.api.sendInvoice(
    ctx.chat.id,
    ctx.userIsEn ? 'Indonesian Bot — Monthly' : 'Indonesian Bot — Месяц',
    ctx.userIsEn
      ? 'Unlimited scenarios for 30 days. Cancel any time from Telegram → My Stars.'
      : 'Безлимит сценариев на 30 дней. Отменить — Telegram → Мои звёзды.',
    PAYLOAD,
    'XTR',
    [{ label: ctx.userIsEn ? 'Monthly' : 'Месяц', amount: STARS_AMOUNT }],
  );
}

export interface RecordPaymentInput {
  telegramId: number;
  telegramChargeId: string;
  starsAmount: number;
  payload: string;
  usersRepo: UsersRepo;
  now?: Date;
}

export async function recordSuccessfulPayment(input: RecordPaymentInput): Promise<boolean> {
  try {
    await PaymentModel.create({
      telegramId: input.telegramId,
      telegramChargeId: input.telegramChargeId,
      starsAmount: input.starsAmount,
      payload: input.payload,
    });
  } catch (err: unknown) {
    if (typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000) {
      return false; // idempotent: already recorded
    }
    throw err;
  }
  const periodEnd = new Date((input.now ?? new Date()).getTime() + 30 * 24 * 60 * 60 * 1000);
  await input.usersRepo.setPlanPaid(input.telegramId, {
    periodEnd,
    telegramStarsSubscriptionId: input.telegramChargeId,
  });
  return true;
}
