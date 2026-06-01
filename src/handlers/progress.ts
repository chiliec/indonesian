import type { BotCtx } from '../bot.js';
import { mainKeyboard } from './keyboard.js';
import { t } from '../util/i18n.js';

/** 📊 Progress button — render per-module mastery from QuizService.moduleList. */
export async function progressHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const en = ctx.userIsEn;
  const modules = await ctx.deps.quiz.moduleList(ctx.from.id);
  if (modules.length === 0) {
    await ctx.reply(t('progress.empty', en), { reply_markup: mainKeyboard(en) });
    return;
  }
  const lines = modules.map((m) => {
    const title = en ? m.titleEn : m.titleRu;
    const filled = Math.round(m.pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return `${bar} ${m.pct}% — ${title}`;
  });
  await ctx.reply(`${t('progress.title', en)}\n${lines.join('\n')}`, {
    parse_mode: 'Markdown',
    reply_markup: mainKeyboard(en),
  });
}
