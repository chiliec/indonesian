import { InlineKeyboard } from 'grammy';
import { t } from '../util/i18n.js';
import type { DailySentenceEntry } from '../services/DailySentenceService.js';
import type { BotCtx } from '../bot.js';
import { editCardSafe } from './practice.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build the daily-sentence message (HTML) and its 🔄 Another button. */
export function renderDailySentence(
  entry: DailySentenceEntry,
  en: boolean,
): { text: string; keyboard: InlineKeyboard } {
  const text =
    `${t('daily.header', en)}\n\n` +
    `<b>${escapeHtml(entry.text)}</b>\n` +
    `${escapeHtml(entry.en)}`;
  const keyboard = new InlineKeyboard().text(t('daily.another', en), 'ds:another');
  return { text, keyboard };
}

/** Pull and persist a fresh sentence for the user. Returns null if pool empty. */
async function nextForUser(ctx: BotCtx, telegramId: number): Promise<DailySentenceEntry | null> {
  const user = await ctx.deps.usersRepo.getByTelegramId(telegramId);
  const picked = ctx.deps.dailySentence.pick(user?.seenSentenceIds ?? []);
  if (!picked) return null;
  await ctx.deps.usersRepo.recordDailySentenceSent(telegramId, new Date(), picked.nextSeenIds);
  return picked.entry;
}

/** /sentence — send a daily sentence on demand. */
export async function sentenceCommand(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const entry = await nextForUser(ctx, ctx.from.id);
  if (!entry) {
    await ctx.reply(t('daily.none', ctx.userIsEn));
    return;
  }
  const { text, keyboard } = renderDailySentence(entry, ctx.userIsEn);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/** ds:another — replace the current message with a new sentence in place. */
export async function dailyAnotherCallback(ctx: BotCtx): Promise<void> {
  await ctx.answerCallbackQuery();
  const msg = ctx.callbackQuery?.message;
  if (!ctx.from || !ctx.chat || !msg) return;
  const entry = await nextForUser(ctx, ctx.from.id);
  if (!entry) return;
  const { text, keyboard } = renderDailySentence(entry, ctx.userIsEn);
  await editCardSafe(ctx.api, ctx.chat.id, msg.message_id, text, keyboard);
}
