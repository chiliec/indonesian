import { InlineKeyboard, InputFile, type Api } from 'grammy';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BotCtx, BotDeps } from '../bot.js';
import type { Question } from '../services/quiz/types.js';
import type { AnswerOutcome } from '../services/QuizService.js';
import { t } from '../util/i18n.js';
import { MIXED_MODULE_ID } from '../services/QuizService.js';
import { mainKeyboard } from './keyboard.js';

const QUIZ_AUDIO_DIR = path.resolve('content/quiz/audio');

/** /quiz and the menu:quiz button — show the module picker. */
export async function quizCommand(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const en = ctx.userIsEn;
  const modules = await ctx.deps.quiz.moduleList(ctx.from.id);
  if (modules.length === 0) {
    await ctx.reply(t('quiz.none', en));
    return;
  }
  const kb = new InlineKeyboard();
  for (const m of modules) {
    const title = en ? m.titleEn : m.titleRu;
    kb.text(`${title} · ${m.pct}%`, `quiz:start:${m.id}`).row();
  }
  await ctx.reply(t('quiz.pick', en), { reply_markup: kb });
}

/** quiz:start:<moduleId> — begin a session and ask Q1. */
export async function quizStartCallback(ctx: BotCtx): Promise<void> {
  if (!ctx.from || !ctx.callbackQuery?.data) return;
  const m = ctx.callbackQuery.data.match(/^quiz:start:(.+)$/);
  if (!m || !m[1]) return;
  await ctx.answerCallbackQuery();

  const res = await ctx.deps.quiz.start(ctx.from.id, m[1]);
  if (!res) {
    await ctx.reply(t('quiz.none', ctx.userIsEn));
    return;
  }
  await ctx.reply(t('quiz.started', ctx.userIsEn));
  await askQuestion(ctx.api, ctx.from.id, ctx.deps, res.session._id, res.first);
}

/** ▶️ Practice button — start an auto-picked Mixed session and ask Q1. */
export async function practiceHandler(ctx: BotCtx): Promise<void> {
  if (!ctx.from) return;
  const en = ctx.userIsEn;
  const res = await ctx.deps.quiz.start(ctx.from.id, MIXED_MODULE_ID);
  if (!res) {
    await ctx.reply(t('quiz.none', en), { reply_markup: mainKeyboard(en) });
    return;
  }
  await ctx.reply(t('quiz.started', en), { reply_markup: mainKeyboard(en) });
  await askQuestion(ctx.api, ctx.from.id, ctx.deps, res.session._id, res.first);
}

/**
 * Send the clip as a playable voice message, then the quiz poll. Poll media
 * (Bot API 10.0) accepts audio but the client renders it as a non-playable
 * icon, so the audio must go in its own message for the learner to hear it.
 */
export async function askQuestion(
  api: Api,
  chatId: number,
  deps: BotDeps,
  sessionId: import('mongoose').Types.ObjectId,
  question: Question,
): Promise<void> {
  if (question.audioFile) await sendQuizAudio(api, chatId, deps, question.audioFile);

  const poll = await api.sendPoll(
    chatId,
    question.promptText,
    question.options.map((text) => ({ text })),
    {
      type: 'quiz',
      correct_option_ids: [question.correctIndex],
      is_anonymous: false,
      explanation: question.explanation,
    },
  );

  await deps.quiz.deps.sessions.setCurrentPoll(sessionId, poll.poll.id);
}

/** Send the OGG/Opus clip as a voice message, reusing/caching its file_id. */
async function sendQuizAudio(api: Api, chatId: number, deps: BotDeps, audioFile: string): Promise<void> {
  const cached = await deps.audioCache.get(audioFile);
  if (cached) {
    await api.sendVoice(chatId, cached);
    return;
  }
  const buf = await fs.readFile(path.join(QUIZ_AUDIO_DIR, audioFile));
  const msg = await api.sendVoice(chatId, new InputFile(buf, audioFile));
  const fileId = msg.voice?.file_id;
  if (fileId) await deps.audioCache.set(audioFile, fileId);
}

/** poll_answer handler — record the answer, then ask next or show summary. */
export async function quizPollAnswer(api: Api, deps: BotDeps, pollId: string, userId: number, chosenIndex: number): Promise<void> {
  const outcome = await deps.quiz.recordAnswer(pollId, chosenIndex);
  if (!outcome) return;
  if (outcome.next) {
    await askQuestion(api, userId, deps, outcome.sessionId, outcome.next.question);
    return;
  }
  await sendSummary(api, deps, outcome);
}

async function sendSummary(api: Api, deps: BotDeps, outcome: AnswerOutcome): Promise<void> {
  const en = true; // poll_answer carries no locale; default to English chrome
  let text = `${t('quiz.summary', en)}${outcome.finalScore}/${outcome.total}`;
  if (outcome.missed.length) {
    // Look up cards across all modules so this works for Mixed sessions too.
    const lines = outcome.missed
      .map((id) => deps.quiz.deps.engine.card(id))
      .filter((c): c is NonNullable<typeof c> => !!c)
      .map((c) => `• ${c.indonesian} — ${c.english}`);
    if (lines.length) text += `\n\n${t('quiz.missed', en)}\n${lines.join('\n')}`;
  }
  const kb = new InlineKeyboard()
    .text(t('quiz.again', en), `quiz:start:${outcome.moduleId}`)
    .row()
    .text(t('quiz.pickAnother', en), 'menu:quiz');
  await api.sendMessage(outcome.telegramId, text, { reply_markup: kb });
}
