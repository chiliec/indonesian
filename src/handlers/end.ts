import type { BotCtx } from '../bot.js';

export async function endCommand(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const session = await ctx.deps.conversation.deps.sessions.findActive(ctx.from.id);
  if (!session) {
    await ctx.reply('No active scenario.');
    return;
  }
  await ctx.deps.conversation.deps.sessions.endSession(session._id, 'user');
  const turnCount = session.turns.length;
  await ctx.reply(`Scenario ended after ${turnCount} turns. /scenarios to start another.`);
}
