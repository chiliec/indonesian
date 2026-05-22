import { InlineKeyboard } from 'grammy';
import type { BotCtx } from '../bot.js';
import { t } from '../util/i18n.js';

export async function voiceHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.message?.voice) return;
  const session = await ctx.deps.conversation.deps.sessions.findActive(ctx.from.id);
  if (!session) {
    await ctx.reply(
      ctx.userIsEn ? 'No active scenario. /scenarios' : 'Нет активного сценария. /scenarios',
    );
    return;
  }
  try {
    const file = await ctx.getFile();
    const url = `https://api.telegram.org/file/bot${ctx.deps.token}/${file.file_path}`;
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    const transcript = await ctx.deps.deepgram.transcribe(buf, 'audio/ogg');
    if (!transcript) {
      await ctx.reply(
        ctx.userIsEn ? "Couldn't hear you — try again?" : 'Не разобрал — повтори?',
      );
      return;
    }
    await ctx.reply(`🗣 _${transcript}_`, { parse_mode: 'Markdown' });
    const result = await ctx.deps.conversation.handleUserTurn(session._id, transcript);
    const kb = new InlineKeyboard().text(
      ctx.userIsEn ? '💡 Correct me' : '💡 Исправь',
      `correct:${session._id.toString()}`,
    );
    await ctx.reply(result.characterReply, { reply_markup: kb });
  } catch (err) {
    ctx.deps.logger.error({ err }, 'voice failed');
    await ctx.reply(t('error.generic', ctx.userIsEn));
  }
}
