import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';

export async function scenariosCommand(ctx: BotCtx): Promise<void> {
  const list = ctx.deps.scenarioEngine.list();
  const en = ctx.userIsEn;
  const kb = new InlineKeyboard();
  for (const s of list) {
    const title = en ? s.title.en : s.title.ru;
    kb.text(`${title} [${s.difficulty}]`, `start:${s.id}`).row();
  }
  await ctx.reply(en ? 'Pick a scenario:' : 'Выбери сценарий:', { reply_markup: kb });
}

export async function startCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.callbackQuery?.data || !ctx.from) return;
  const m = ctx.callbackQuery.data.match(/^start:(.+)$/);
  if (!m || !m[1]) return;
  await ctx.answerCallbackQuery();
  // quota check happens in Task 18 paywall — for now allow
  const { opener } = await ctx.deps.conversation.start(ctx.from.id, m[1]);
  await ctx.reply(opener);
}
