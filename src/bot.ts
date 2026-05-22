import { Bot, Context } from 'grammy';
import type { Logger } from 'pino';
import { Types } from 'mongoose';
import type { UsersRepo } from './db/users.js';
import type { ConversationService } from './services/ConversationService.js';
import type { CorrectionService } from './services/CorrectionService.js';
import type { DeepgramService } from './services/DeepgramService.js';
import type { ScenarioEngine } from './services/scenarios/ScenarioEngine.js';
import { t, isEn } from './util/i18n.js';
import { menuCommand } from './handlers/menu.js';
import { langCommand, langCallback } from './handlers/lang.js';
import { scenariosCommand, startCallback } from './handlers/scenarios.js';
import { textHandler } from './handlers/text.js';
import { voiceHandler } from './handlers/voice.js';
import { endCommand } from './handlers/end.js';

export interface BotDeps {
  token: string;
  usersRepo: UsersRepo;
  conversation: ConversationService;
  correction: CorrectionService;
  deepgram: DeepgramService;
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

  bot.command('end', endCommand);

  bot.callbackQuery(/^correct:(.+)$/, async (ctx) => {
    if (!ctx.from || !ctx.callbackQuery.data) return;
    await ctx.answerCallbackQuery();
    const parts = ctx.callbackQuery.data.split(':');
    const sid = parts[1];
    if (!sid) return;
    let sessionObjectId: Types.ObjectId;
    try {
      sessionObjectId = new Types.ObjectId(sid);
    } catch {
      return;
    }
    const session = await deps.conversation.deps.sessions.findById(sessionObjectId);
    if (!session) return;
    const turns = session.turns;
    const reversedUserIdx = [...turns].reverse().findIndex((t) => t.role === 'user');
    if (reversedUserIdx < 0) return;
    const userTurnIdx = turns.length - 1 - reversedUserIdx;
    const userTurn = turns[userTurnIdx];
    const assistantTurn = turns[userTurnIdx + 1];
    if (!userTurn || !assistantTurn) return;
    try {
      const recap = await deps.correction.correctLastTurn({
        telegramId: ctx.from.id,
        sessionId: session._id,
        userText: userTurn.text,
        characterReply: assistantTurn.text,
        userIsEn: ctx.userIsEn,
      });
      await ctx.reply(recap);
    } catch (err) {
      deps.logger.error({ err }, 'correctLastTurn failed');
      await ctx.reply(t('error.generic', ctx.userIsEn));
    }
  });

  bot.on('message:text', textHandler);
  bot.on('message:voice', voiceHandler);

  bot.catch((err) => {
    deps.logger.error({ err: err.error, update: err.ctx.update }, 'bot error');
  });

  return bot;
}
