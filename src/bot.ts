import { Bot, Context } from 'grammy';
import type { Logger } from 'pino';
import { Types } from 'mongoose';
import type { UsersRepo } from './db/users.js';
import type { ConversationService } from './services/ConversationService.js';
import type { CorrectionService } from './services/CorrectionService.js';
import type { DeepgramService } from './services/DeepgramService.js';
import type { TtsService } from './services/TtsService.js';
import type { ScenarioEngine } from './services/scenarios/ScenarioEngine.js';
import type { Entitlement } from './services/Entitlement.js';
import { t, isEn } from './util/i18n.js';
import { settingsCommand, settingsHelpCallback, settingsSpeakCallback, settingsLengthCallback } from './handlers/settings.js';
import { mainKeyboard } from './handlers/keyboard.js';
import { langCommand, langCallback } from './handlers/lang.js';
import { scenariosCommand, startCallback } from './handlers/scenarios.js';
import { textHandler } from './handlers/text.js';
import { voiceHandler } from './handlers/voice.js';
import { endCommand } from './handlers/end.js';
import { subscribeCommand, recordSuccessfulPayment } from './handlers/subscribe.js';
import { statsCommand } from './handlers/stats.js';
import { practiceHandler, practiceStartCallback, modulePicker, sessionCallback } from './handlers/practice.js';
import type { QuizService } from './services/QuizService.js';
import type { AudioCacheRepo } from './db/audioCache.js';
import type { SessionEngine } from './services/session/SessionEngine.js';

/** The only commands advertised in Telegram's command menu. */
export const ADVERTISED_COMMANDS = [
  { command: 'start', description: 'Open the bot / show the keyboard' },
] as const;

export interface BotDeps {
  token: string;
  usersRepo: UsersRepo;
  conversation: ConversationService;
  correction: CorrectionService;
  deepgram: DeepgramService;
  tts: TtsService;
  scenarioEngine: ScenarioEngine;
  entitlement: Entitlement;
  quiz: QuizService;
  audioCache: AudioCacheRepo;
  study: SessionEngine;
  adminIds: string;
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
    await ctx.reply(t('start.welcome', ctx.userIsEn), {
      reply_markup: mainKeyboard(ctx.userIsEn),
    });
  });

  bot.command('menu', settingsCommand); // silent alias
  bot.callbackQuery('menu:settings', settingsCommand);
  bot.callbackQuery('settings:help', settingsHelpCallback);
  bot.callbackQuery('settings:speak', settingsSpeakCallback);
  bot.callbackQuery('settings:length', settingsLengthCallback);
  bot.callbackQuery('settings:modules', modulePicker);
  bot.command('lang', langCommand);
  bot.callbackQuery(/^lang:(en|ru)$/, langCallback);
  bot.callbackQuery('menu:lang', langCommand);

  bot.command('scenarios', scenariosCommand);
  bot.callbackQuery('menu:scenarios', scenariosCommand);
  bot.callbackQuery(/^start:.+$/, startCallback);

  bot.command('quiz', practiceHandler);
  bot.callbackQuery('menu:quiz', modulePicker);
  bot.callbackQuery(/^practice:start:.+$/, practiceStartCallback);
  bot.callbackQuery('p:again', practiceHandler);
  bot.callbackQuery(/^s:[0-9a-f]{24}:.+$/, sessionCallback);

  bot.command('end', endCommand);

  bot.command('subscribe', subscribeCommand);
  bot.callbackQuery('menu:subscribe', subscribeCommand);

  bot.command('stats', statsCommand);

  bot.on('pre_checkout_query', async (ctx) => {
    await ctx.answerPreCheckoutQuery(true);
  });

  bot.on('message:successful_payment', async (ctx) => {
    const sp = ctx.message?.successful_payment;
    if (!sp || !ctx.from) return;
    const promoted = await recordSuccessfulPayment({
      telegramId: ctx.from.id,
      telegramChargeId: sp.telegram_payment_charge_id,
      starsAmount: sp.total_amount,
      payload: sp.invoice_payload,
      usersRepo: deps.usersRepo,
    });
    if (promoted) {
      await ctx.reply(ctx.userIsEn
        ? '✅ Subscription active for 30 days. Enjoy unlimited practice!'
        : '✅ Подписка активна на 30 дней. Безлимит — твой.');
    }
  });

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
        ...(userTurn.audioFileId ? { audioFileId: userTurn.audioFileId } : {}),
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
