import type { UsersRepo } from '../db/users.js';
import type { QuotaService } from './QuotaService.js';

export type EntitlementReason = 'paid' | 'free-quota' | 'free-exhausted';

export interface EntitlementResult {
  allowed: boolean;
  reason: EntitlementReason;
}

export interface EntitlementDeps {
  users: UsersRepo;
  quota: QuotaService;
}

export class Entitlement {
  constructor(private deps: EntitlementDeps) {}

  async canStartScenario(telegramId: number, now: Date = new Date()): Promise<EntitlementResult> {
    const user = await this.deps.users.getByTelegramId(telegramId);
    if (
      user?.plan === 'paid' &&
      user.subscriptionPeriodEnd &&
      user.subscriptionPeriodEnd > now
    ) {
      return { allowed: true, reason: 'paid' };
    }
    const ok = await this.deps.quota.tryConsume(telegramId, now);
    return ok
      ? { allowed: true, reason: 'free-quota' }
      : { allowed: false, reason: 'free-exhausted' };
  }
}
