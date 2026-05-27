import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';

export async function menuCommand(ctx: BotCtx) {
  const en = ctx.userIsEn;
  const kb = new InlineKeyboard()
    .text(t('menu.scenarios', en), 'menu:scenarios')
    .text(t('menu.quiz', en), 'menu:quiz')
    .row()
    .text(t('menu.lang', en), 'menu:lang')
    .text(t('menu.subscribe', en), 'menu:subscribe')
    .row()
    .text(t('menu.help', en), 'menu:help');
  await ctx.reply(t('menu.title', en), { reply_markup: kb, parse_mode: 'Markdown' });
}
