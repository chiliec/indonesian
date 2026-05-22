import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';

export async function textHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.message?.text) return;
  if (ctx.message.text.startsWith('/')) return;

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
    await ctx.reply(result.characterReply);
  } catch (err) {
    ctx.deps.logger.error({ err }, 'handleUserTurn failed');
    await ctx.reply(t('error.generic', ctx.userIsEn));
  }
}
