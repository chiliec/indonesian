import { InlineKeyboard, InputFile, type Api } from 'grammy';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BotCtx, BotDeps } from '../bot.js';
import type { Question } from '../services/quiz/types.js';
import type { AnswerOutcome } from '../services/QuizService.js';
import { t } from '../util/i18n.js';

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

/** Send the quiz poll with audio embedded in the question (Bot API 10.0 media). */
export async function askQuestion(
  api: Api,
  chatId: number,
  deps: BotDeps,
  sessionId: import('mongoose').Types.ObjectId,
  question: Question,
): Promise<void> {
  const media = question.audioFile
    ? { type: 'audio' as const, media: await resolveQuizAudio(deps, question.audioFile) }
    : undefined;

  const poll = await api.sendPoll(
    chatId,
    question.promptText,
    question.options.map((text) => ({ text })),
    {
      type: 'quiz',
      correct_option_ids: [question.correctIndex],
      is_anonymous: false,
      explanation: question.explanation,
      ...(media ? { media } : {}),
    },
  );

  // Cache the audio file_id Telegram surfaces on the returned poll, so the next
  // send reuses it instead of re-uploading the OGG. (audio != voice file_id.)
  const fileId = poll.poll.media?.audio?.file_id;
  if (question.audioFile && fileId) {
    await deps.audioCache.set(question.audioFile, fileId, 'audio');
  }

  await deps.quiz.deps.sessions.setCurrentPoll(sessionId, poll.poll.id);
}

/** Cached audio file_id, or a fresh InputFile read from disk for first upload. */
async function resolveQuizAudio(deps: BotDeps, audioFile: string): Promise<string | InputFile> {
  const cached = await deps.audioCache.get(audioFile, 'audio');
  if (cached) return cached;
  const buf = await fs.readFile(path.join(QUIZ_AUDIO_DIR, audioFile));
  return new InputFile(buf, audioFile);
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
