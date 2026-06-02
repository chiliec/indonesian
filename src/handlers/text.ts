import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';
import { matchAction } from './keyboard.js';
import { practiceHandler } from './quiz.js';
import { scenariosButtonHandler } from './scenarios.js';
import { progressHandler } from './progress.js';
import { settingsCommand } from './settings.js';

export async function textHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.message?.text) return;
  if (ctx.message.text.startsWith('/')) return;

  const action = matchAction(ctx.message.text);
  if (action) {
    if (action === 'practice') return practiceHandler(ctx);
    if (action === 'scenarios') return scenariosButtonHandler(ctx);
    if (action === 'progress') return progressHandler(ctx);
    if (action === 'settings') return settingsCommand(ctx);
  }

  const session = await ctx.deps.conversation.deps.sessions.findActive(ctx.from.id);
  if (!session) {
    await ctx.reply(
      ctx.userIsEn
        ? 'No active scenario. Use /scenarios to pick one.'
        : 'Нет активного сценария. Открой /scenarios.',
    );
    return;
  }
  try {
    const result = await ctx.deps.conversation.handleUserTurn(session._id, ctx.message.text);
    const kb = new InlineKeyboard().text(
      ctx.userIsEn ? '💡 Correct me' : '💡 Исправь',
      `correct:${session._id.toString()}`,
    );
    await ctx.reply(result.characterReply, { reply_markup: kb });
  } catch (err) {
    ctx.deps.logger.error({ err }, 'handleUserTurn failed');
    await ctx.reply(t('error.generic', ctx.userIsEn));
  }
}
