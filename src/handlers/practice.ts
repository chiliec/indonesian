import { InlineKeyboard, InputFile, type Api } from 'grammy';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BotCtx, BotDeps } from '../bot.js';
import type { TurnResult } from '../services/session/SessionEngine.js';
import type { CardView } from '../services/session/types.js';
import { MIXED_MODULE_ID } from '../services/QuizService.js';
import { mainKeyboard } from './keyboard.js';
import { t } from '../util/i18n.js';

const QUIZ_AUDIO_DIR = path.resolve('content/quiz/audio');

export function toKeyboard(view: CardView): InlineKeyboard | undefined {
  if (view.buttons.length === 0) return undefined;
  const kb = new InlineKeyboard();
  for (const row of view.buttons) {
    for (const b of row) kb.text(b.text, b.data);
    kb.row();
  }
  return kb;
}

export interface ParsedCallback {
  sid: string;
  op: 'a' | 't' | 'u' | 'n';
  arg: number | null;
}

export function parseSessionCallback(data: string): ParsedCallback | null {
  const m = data.match(/^s:([0-9a-f]{24}):(a|t|u|n)(?::(\d+))?$/);
  if (!m) return null;
  return { sid: m[1]!, op: m[2] as ParsedCallback['op'], arg: m[3] !== undefined ? Number(m[3]) : null };
}

type EditApi = Pick<Api, 'editMessageText' | 'sendMessage'>;

/** Edit the card; tolerate not-modified, resend if deleted, retry once on 429. */
export async function editCardSafe(
  api: EditApi,
  chatId: number,
  messageId: number,
  text: string,
  kb: InlineKeyboard | undefined,
): Promise<number> {
  const opts = { parse_mode: 'HTML' as const, ...(kb ? { reply_markup: kb } : {}) };
  try {
    await api.editMessageText(chatId, messageId, text, opts);
    return messageId;
  } catch (err) {
    const desc = (err as { description?: string }).description ?? String(err);
    if (desc.includes('message is not modified')) return messageId;
    if (desc.includes('message to edit not found')) {
      const msg = await api.sendMessage(chatId, text, opts);
      return msg.message_id;
    }
    const retryAfter = (err as { parameters?: { retry_after?: number } }).parameters?.retry_after;
    if (retryAfter) {
      await new Promise((r) => setTimeout(r, retryAfter * 1000));
      await api.editMessageText(chatId, messageId, text, opts);
      return messageId;
    }
    throw err;
  }
}

/** Send the OGG clip as a voice message, reusing/caching its file_id. */
async function sendSessionAudio(api: Api, chatId: number, deps: BotDeps, audioFile: string): Promise<number> {
  const cached = await deps.audioCache.get(audioFile);
  if (cached) {
    const m = await api.sendVoice(chatId, cached);
    return m.message_id;
  }
  const buf = await fs.readFile(path.join(QUIZ_AUDIO_DIR, audioFile));
  const msg = await api.sendVoice(chatId, new InputFile(buf, audioFile));
  if (msg.voice?.file_id) await deps.audioCache.set(audioFile, msg.voice.file_id);
  return msg.message_id;
}

/** Apply a TurnResult to Telegram: juggle the audio message, edit (or send) the card. */
export async function applyTurn(api: Api, deps: BotDeps, r: TurnResult): Promise<void> {
  const { session, view } = r;
  const chatId = session.chatId;

  // audio: delete the previous clip, send the new one (if any) so it sits above the card
  if (session.audioMessageId) {
    try {
      await api.deleteMessage(chatId, session.audioMessageId);
    } catch (err) {
      deps.logger.debug({ err }, 'audio delete failed (already gone?)');
    }
    await deps.study.deps.sessions.setMessages(session._id, { audioMessageId: null });
  }
  if (view.audioFile && !view.finished) {
    try {
      const audioMessageId = await sendSessionAudio(api, chatId, deps, view.audioFile);
      await deps.study.deps.sessions.setMessages(session._id, { audioMessageId });
    } catch (err) {
      deps.logger.warn({ err, audioFile: view.audioFile }, 'session audio send failed; continuing without it');
    }
  }

  const kb = toKeyboard(view);
  if (session.cardMessageId) {
    const newId = await editCardSafe(api, chatId, session.cardMessageId, view.text, kb);
    if (newId !== session.cardMessageId) {
      await deps.study.deps.sessions.setMessages(session._id, { cardMessageId: newId });
    }
  } else {
    const opts = { parse_mode: 'HTML' as const, ...(kb ? { reply_markup: kb } : {}) };
    const msg = await api.sendMessage(chatId, view.text, opts);
    await deps.study.deps.sessions.setMessages(session._id, { cardMessageId: msg.message_id });
  }
}

/** Practice button / p:again — start (or re-focus) a session. */
export async function practiceHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.chat) return;
  const en = ctx.userIsEn;

  // one session per user: re-focus the existing card instead of starting another
  const existing = await ctx.deps.study.deps.sessions.findActive(ctx.from.id);
  if (existing?.cardMessageId) {
    try {
      await ctx.api.deleteMessage(existing.chatId, existing.cardMessageId);
    } catch (err) {
      ctx.deps.logger.debug({ err }, 'old card delete failed');
    }
    await ctx.deps.study.deps.sessions.setMessages(existing._id, { cardMessageId: 0 });
    // re-render current question as a fresh message at the bottom of the chat
    const refocus = await ctx.deps.study.refocus(ctx.from.id, en);
    if (refocus) {
      await applyTurn(ctx.api, ctx.deps, refocus);
      return;
    }
  }

  const r = await ctx.deps.study.start(ctx.from.id, ctx.chat.id, MIXED_MODULE_ID, en);
  if (!r) {
    await ctx.reply(t('quiz.none', en), { reply_markup: mainKeyboard(en) });
    return;
  }
  await applyTurn(ctx.api, ctx.deps, r);
}

/** practice:start:<moduleId> — start a session in a specific module. */
export async function practiceStartCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.chat || !ctx.callbackQuery?.data) return;
  const m = ctx.callbackQuery.data.match(/^practice:start:(.+)$/);
  if (!m || !m[1]) return;
  await ctx.answerCallbackQuery();
  const r = await ctx.deps.study.start(ctx.from.id, ctx.chat.id, m[1], ctx.userIsEn);
  if (!r) {
    await ctx.reply(t('quiz.none', ctx.userIsEn));
    return;
  }
  await applyTurn(ctx.api, ctx.deps, r);
}

/** settings:modules / menu:quiz — module picker (replaces the old quizCommand). */
export async function modulePicker(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const en = ctx.userIsEn;
  const modules = await ctx.deps.quiz.moduleList(ctx.from.id);
  if (modules.length === 0) {
    await ctx.reply(t('quiz.none', en));
    return;
  }
  const kb = new InlineKeyboard();
  for (const m of modules) {
    kb.text(`${en ? m.titleEn : m.titleRu} · ${m.pct}%`, `practice:start:${m.id}`).row();
  }
  await ctx.reply(t('quiz.pick', en), { reply_markup: kb });
}

/** s:<sid>:<op>[:<arg>] — all in-session button taps. */
export async function sessionCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.callbackQuery?.data) return;
  const p = parseSessionCallback(ctx.callbackQuery.data);
  if (!p) {
    await ctx.answerCallbackQuery();
    return;
  }
  const en = ctx.userIsEn;
  const eng = ctx.deps.study;
  let r = null;
  if (p.op === 'a' && p.arg !== null) r = await eng.submitChoice(ctx.from.id, p.sid, p.arg, en);
  else if (p.op === 't' && p.arg !== null) r = await eng.tapTile(ctx.from.id, p.sid, p.arg, en);
  else if (p.op === 'u') r = await eng.undoTile(ctx.from.id, p.sid, en);
  else if (p.op === 'n') r = await eng.next(ctx.from.id, p.sid, en);

  if (!r) {
    await ctx.answerCallbackQuery({ text: t('session.expiredToast', en) });
    return;
  }
  await ctx.answerCallbackQuery();
  await applyTurn(ctx.api, ctx.deps, r);
}

/** typed text → study session? true = consumed. */
export async function tryStudyTyped(ctx: BotCtx): Promise<boolean> {
  if (!ctx.from || !ctx.message?.text) return false;
  const r = await ctx.deps.study.submitTyped(ctx.from.id, ctx.message.text, ctx.userIsEn);
  if (!r) return false;
  await applyTurn(ctx.api, ctx.deps, r);
  return true;
}

/** voice transcript → study session? true = consumed. */
export async function tryStudyVoice(ctx: BotCtx, transcript: string): Promise<boolean> {
  if (!ctx.from) return false;
  const r = await ctx.deps.study.submitSpoken(ctx.from.id, transcript, ctx.userIsEn);
  if (!r) return false;
  await applyTurn(ctx.api, ctx.deps, r);
  return true;
}

/** Interval sweep: expire idle sessions and morph their cards into finish screens. */
export async function sweepStudySessions(api: Api, deps: BotDeps, maxAgeMs: number): Promise<number> {
  const expired = await deps.study.expireStale(maxAgeMs);
  for (const r of expired) {
    if (!r.session.cardMessageId) continue;
    try {
      await editCardSafe(api, r.session.chatId, r.session.cardMessageId, r.view.text, toKeyboard(r.view));
    } catch (err) {
      deps.logger.warn({ err }, 'expired-card edit failed');
    }
  }
  return expired.length;
}
