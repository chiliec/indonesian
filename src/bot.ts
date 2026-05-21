import { Bot, Context } from 'grammy';
import type { Logger } from 'pino';
import type { UsersRepo } from './db/users.js';
import { t, isEn } from './util/i18n.js';

export interface BotDeps {
  token: string;
  usersRepo: UsersRepo;
  logger: Logger;
}

export interface BotCtx extends Context {
  deps: BotDeps;
  userIsEn: boolean;
}

export function createBot(deps: BotDeps): Bot<BotCtx> {
  const bot = new Bot<BotCtx>(deps.token);

  bot.use(async (ctx, next) => {
    ctx.deps = deps;
    const tgUser = ctx.from;
    if (tgUser) {
      const initialLocale = tgUser.language_code === 'ru' ? 'ru' : 'en';
      const user = await deps.usersRepo.upsertByTelegramId(tgUser.id, { locale: initialLocale });
      ctx.userIsEn = isEn(user.locale);
    } else {
      ctx.userIsEn = true;
    }
    await next();
  });

  bot.command('start', async (ctx) => {
    await ctx.reply(t('start.welcome', ctx.userIsEn));
  });

  bot.catch((err) => {
    deps.logger.error({ err: err.error, update: err.ctx.update }, 'bot error');
  });

  return bot;
}
