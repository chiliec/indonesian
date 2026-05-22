import { Bot, Context } from 'grammy';
import type { Logger } from 'pino';
import type { UsersRepo } from './db/users.js';
import type { ConversationService } from './services/ConversationService.js';
import type { ScenarioEngine } from './services/scenarios/ScenarioEngine.js';
import { t, isEn } from './util/i18n.js';
import { menuCommand } from './handlers/menu.js';
import { langCommand, langCallback } from './handlers/lang.js';
import { scenariosCommand, startCallback } from './handlers/scenarios.js';
import { textHandler } from './handlers/text.js';

export interface BotDeps {
  token: string;
  usersRepo: UsersRepo;
  conversation: ConversationService;
  scenarioEngine: ScenarioEngine;
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
      const defaultLocale = tgUser.language_code === 'ru' ? 'ru' : 'en';
      const user = await deps.usersRepo.touchUser(tgUser.id, { defaultLocale });
      ctx.userIsEn = isEn(user.locale);
    } else {
      ctx.userIsEn = true;
    }
    await next();
  });

  bot.command('start', async (ctx) => {
    await ctx.reply(t('start.welcome', ctx.userIsEn));
  });

  bot.command('menu', menuCommand);
  bot.command('lang', langCommand);
  bot.callbackQuery(/^lang:(en|ru)$/, langCallback);
  bot.callbackQuery('menu:lang', langCommand);

  bot.command('scenarios', scenariosCommand);
  bot.callbackQuery('menu:scenarios', scenariosCommand);
  bot.callbackQuery(/^start:.+$/, startCallback);

  bot.on('message:text', textHandler);

  bot.catch((err) => {
    deps.logger.error({ err: err.error, update: err.ctx.update }, 'bot error');
  });

  return bot;
}
