import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';

const LENGTH_CYCLE = [5, 10, 20];

const HELP_TEXT =
  'Tap ▶️ Practice for vocabulary drills, 🎭 Scenarios to roleplay in Indonesian. ' +
  "📊 Progress shows your mastery. That's it — no commands to remember!";

/** ⚙️ Settings button / /menu alias — inline menu for the rare actions. */
export async function settingsCommand(ctx: BotCtx): Promise<void> {
  const user = ctx.from ? await ctx.deps.usersRepo.getByTelegramId(ctx.from.id) : null;
  const speak = user?.speakOptIn ?? false;
  const len = user?.sessionLength ?? 10;
  const dailyOn = !(user?.dailySentenceOptOut ?? false);
  const kb = new InlineKeyboard()
    .text('⭐ Subscribe', 'menu:subscribe')
    .text('🎯 Pick a module', 'settings:modules')
    .row()
    .text('❓ Help', 'settings:help')
    .text(speak ? '🎤 Speaking: ON' : '🎤 Speaking: OFF', 'settings:speak')
    .row()
    .text(`🔢 Session length: ${len}`, 'settings:length')
    .text(dailyOn ? '🌅 Daily sentence: ON' : '🌅 Daily sentence: OFF', 'settings:daily');
  await ctx.reply('⚙️ *Settings*', { reply_markup: kb, parse_mode: 'Markdown' });
}

/** settings:help — show the one-screen help text. */
export async function settingsHelpCallback(ctx: BotCtx): Promise<void> {
  await ctx.answerCallbackQuery();
  await ctx.reply(HELP_TEXT, { parse_mode: 'Markdown' });
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

/** settings:daily — toggle the daily-sentence push and re-render the menu. */
export async function settingsDailyCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  await ctx.answerCallbackQuery();
  const user = await ctx.deps.usersRepo.getByTelegramId(ctx.from.id);
  const currentlyOn = !(user?.dailySentenceOptOut ?? false);
  // turning off => opt-out true; turning on => opt-out false
  await ctx.deps.usersRepo.setDailySentenceOptOut(ctx.from.id, currentlyOn);
  await settingsCommand(ctx);
}
