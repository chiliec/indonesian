import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';

/** ⚙️ Settings button / /menu alias — inline menu for the rare actions. */
export async function settingsCommand(ctx: BotCtx): Promise<void> {
  const en = ctx.userIsEn;
  const kb = new InlineKeyboard()
    .text(t('settings.lang', en), 'menu:lang')
    .text(t('settings.subscribe', en), 'menu:subscribe')
    .row()
    .text(t('settings.modules', en), 'settings:modules')
    .text(t('settings.help', en), 'settings:help');
  await ctx.reply(t('settings.title', en), { reply_markup: kb, parse_mode: 'Markdown' });
}

/** settings:help — show the one-screen help text. */
export async function settingsHelpCallback(ctx: BotCtx): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply(t('settings.helpText', ctx.userIsEn), { parse_mode: 'Markdown' });
}
