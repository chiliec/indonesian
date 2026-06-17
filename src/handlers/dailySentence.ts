import { InlineKeyboard, type Api } from 'grammy';
import type { DailySentenceEntry } from '../services/DailySentenceService.js';
import type { BotCtx, BotDeps } from '../bot.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build the daily-sentence message (HTML) and its 🔄 Another button. */
export function renderDailySentence(
  entry: DailySentenceEntry,
): { text: string; keyboard: InlineKeyboard } {
  const text =
    '🌅 Sentence of the day\n\n' +
    `<b>${escapeHtml(entry.text)}</b>\n` +
    `${escapeHtml(entry.en)}`;
  const keyboard = new InlineKeyboard().text('🔄 Another sentence', 'ds:another');
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
    await ctx.reply('No sentence available yet — check back soon!');
    return;
  }
  const { text, keyboard } = renderDailySentence(entry);
  await ctx.reply(text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/** ds:another — send a fresh sentence as a new message so history stays readable. */
export async function dailyAnotherCallback(ctx: BotCtx): Promise<void> {
  await ctx.answerCallbackQuery();
  const msg = ctx.callbackQuery?.message;
  if (!ctx.from || !ctx.chat || !msg) return;
  const entry = await nextForUser(ctx, ctx.from.id);
  if (!entry) return;
  // Drop the button on the previous message so only the newest one is actionable.
  await ctx.api
    .editMessageReplyMarkup(ctx.chat.id, msg.message_id, { reply_markup: undefined })
    .catch(() => undefined);
  const { text, keyboard } = renderDailySentence(entry);
  await ctx.api.sendMessage(ctx.chat.id, text, { parse_mode: 'HTML', reply_markup: keyboard });
}

/**
 * Send the daily sentence to every eligible user whose target time (the hh:mm of
 * their last activity, UTC) has arrived today. Sequential to respect Telegram
 * rate limits. Returns the number of messages sent.
 */
export async function sweepDailySentences(
  api: Api,
  deps: BotDeps,
  opts: { now: Date; activeWindowMs: number },
): Promise<number> {
  const { now } = opts;
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const activeSince = new Date(now.getTime() - opts.activeWindowMs);
  const candidates = await deps.usersRepo.findDailySentenceCandidates({ activeSince, dayStart });

  let sent = 0;
  for (const user of candidates) {
    const ls = user.lastSeenAt;
    const target = new Date(
      Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        ls.getUTCHours(),
        ls.getUTCMinutes(),
      ),
    );
    if (now < target) continue; // not yet their hour today

    const picked = deps.dailySentence.pick(user.seenSentenceIds ?? []);
    if (!picked) continue; // empty pool

    const { text, keyboard } = renderDailySentence(picked.entry);
    try {
      await api.sendMessage(user.telegramId, text, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
      await deps.usersRepo.recordDailySentenceSent(user.telegramId, now, picked.nextSeenIds);
      sent++;
    } catch (err) {
      const code = (err as { error_code?: number }).error_code;
      if (code === 403) {
        await deps.usersRepo.setDailySentenceOptOut(user.telegramId, true);
        deps.logger.info({ telegramId: user.telegramId }, 'daily sentence: blocked, opted out');
      } else {
        deps.logger.warn({ err, telegramId: user.telegramId }, 'daily sentence send failed');
      }
    }
  }
  return sent;
}
