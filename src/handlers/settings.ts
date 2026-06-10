import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';

const LENGTH_CYCLE = [5, 10, 20];

/** ⚙️ Settings button / /menu alias — inline menu for the rare actions. */
export async function settingsCommand(ctx: BotCtx): Promise<void> {
  const en = ctx.userIsEn;
  const user = ctx.from ? await ctx.deps.usersRepo.getByTelegramId(ctx.from.id) : null;
  const speak = user?.speakOptIn ?? false;
  const len = user?.sessionLength ?? 10;
  const kb = new InlineKeyboard()
    .text(t('settings.lang', en), 'menu:lang')
    .text(t('settings.subscribe', en), 'menu:subscribe')
    .row()
    .text(t('settings.modules', en), 'settings:modules')
    .text(t('settings.help', en), 'settings:help')
    .row()
    .text(t(speak ? 'settings.speakOn' : 'settings.speakOff', en), 'settings:speak')
    .text(`${t('settings.length', en)}${len}`, 'settings:length');
  await ctx.reply(t('settings.title', en), { reply_markup: kb, parse_mode: 'Markdown' });
}

/** settings:help — show the one-screen help text. */
export async function settingsHelpCallback(ctx: BotCtx): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply(t('settings.helpText', ctx.userIsEn), { parse_mode: 'Markdown' });
}

/** settings:speak — toggle speaking exercises and re-render the menu. */
export async function settingsSpeakCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCallbackQuery();
  const user = await ctx.deps.usersRepo.getByTelegramId(ctx.from.id);
  await ctx.deps.usersRepo.setSpeakOptIn(ctx.from.id, !(user?.speakOptIn ?? false));
  await settingsCommand(ctx);
}

/** settings:length — cycle 5 → 10 → 20 and re-render the menu. */
export async function settingsLengthCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCallbackQuery();
  const user = await ctx.deps.usersRepo.getByTelegramId(ctx.from.id);
  const cur = user?.sessionLength ?? 10;
  const next = LENGTH_CYCLE[(LENGTH_CYCLE.indexOf(cur) + 1) % LENGTH_CYCLE.length]!;
  await ctx.deps.usersRepo.setSessionLength(ctx.from.id, next);
  await settingsCommand(ctx);
}
