import { QuotaModel } from '../db/quotas.js';

export function utcDayKey(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const FREE_DAILY_LIMIT = 1;

export class QuotaService {
  async tryConsume(telegramId: number, now: Date = new Date()): Promise<boolean> {
    const dayKey = utcDayKey(now);
    try {
      const res = await QuotaModel.findOneAndUpdate(
        { telegramId, dayKey, scenariosStarted: { $lt: FREE_DAILY_LIMIT } },
        { $inc: { scenariosStarted: 1 }, $setOnInsert: { telegramId, dayKey } },
        { upsert: true, new: true },
      ).lean();
      return !!res;
    } catch (err: unknown) {
      if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: number }).code === 11000) {
        return false;
      }
      throw err;
    }
  }
}
