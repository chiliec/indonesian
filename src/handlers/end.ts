import type { BotCtx } from '../bot.js';

export async function endCommand(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const session = await ctx.deps.conversation.deps.sessions.findActive(ctx.from.id);
  if (!session) {
    await ctx.reply(ctx.userIsEn ? 'No active scenario.' : 'Нет активного сценария.');
    return;
  }
  await ctx.deps.conversation.deps.sessions.endSession(session._id, 'user');
  const turnCount = session.turns.length;
  await ctx.reply(
    ctx.userIsEn
      ? `Scenario ended after ${turnCount} turns. /scenarios to start another.`
      : `Сценарий завершён, ходов: ${turnCount}. /scenarios — выбрать новый.`,
  );
}
