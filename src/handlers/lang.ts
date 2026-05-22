import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';

export function parseLangCallback(data: string): 'en' | 'ru' | null {
  if (data === 'lang:en') return 'en';
  if (data === 'lang:ru') return 'ru';
  return null;
}

export async function langCommand(ctx: BotCtx) {
  const kb = new InlineKeyboard()
    .text('English', 'lang:en')
    .text('Русский', 'lang:ru');
  await ctx.reply(t('lang.prompt', ctx.userIsEn), { reply_markup: kb });
}

export async function langCallback(ctx: BotCtx) {
  if (!ctx.callbackQuery?.data || !ctx.from) return;
  const choice = parseLangCallback(ctx.callbackQuery.data);
  if (!choice) return;
  await ctx.deps.usersRepo.setLocale(ctx.from.id, choice);
  const en = choice === 'en';
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(t(en ? 'lang.picked.en' : 'lang.picked.ru', en));
}
