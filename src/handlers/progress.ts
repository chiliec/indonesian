import type { BotCtx } from '../bot.js';
import { mainKeyboard } from './keyboard.js';

/** 📊 Progress button — render per-module mastery from QuizService.moduleList. */
export async function progressHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const modules = await ctx.deps.quiz.moduleList(ctx.from.id);
  if (modules.length === 0) {
    await ctx.reply('No progress yet — tap ▶️ Practice to start!', { reply_markup: mainKeyboard() });
    return;
  }
  const lines = modules.map((m) => {
    const filled = Math.round(m.pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `${bar} ${m.pct}% — ${m.title}`;
  });
  await ctx.reply(`📊 *Your progress*\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard(),
  });
}
