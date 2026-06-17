import { Types } from 'mongoose';
import type { Logger } from 'pino';
import type { QuizEngine } from '../quiz/QuizEngine.js';
import type { QuizCard } from '../quiz/types.js';
import { MIXED_MODULE_ID } from '../QuizService.js';
import type { StudySessionsRepo, StudySession } from '../../db/studySessions.js';
import type { QuizProgressRepo } from '../../db/quizProgress.js';
import type { UserStatsRepo } from '../../db/userStats.js';
import type { UsersRepo } from '../../db/users.js';
import { masteryOf, pickKind, buildExercise, orderByMastery } from './ExerciseFactory.js';
import { renderQuestion, renderFeedback, renderFinish, type QuestionView } from './ExerciseRenderer.js';
import { matchAnswer } from './normalize.js';
import { xpFor, COMPLETION_BONUS } from './xp.js';
import type { CardView, Exercise } from './types.js';

const DEFAULT_SESSION_LENGTH = 10;

/** narrow interface so tests can pass null; AnthropicService satisfies it structurally */
export interface SpeakJudge {
  judgeSpokenAnswer(transcript: string, target: string): Promise<boolean>;
}

export interface SessionEngineDeps {
  engine: QuizEngine;
  sessions: StudySessionsRepo;
  progress: QuizProgressRepo;
  stats: UserStatsRepo;
  users: UsersRepo;
  judge: SpeakJudge | null;
  logger: Logger;
}

export interface TurnResult {
  session: StudySession;
  view: CardView;
}

export class SessionEngine {
  // deps is public: handlers reach the repos through the engine (e.g. setMessages)
  constructor(public readonly deps: SessionEngineDeps) {}

  private pool(moduleId: string): QuizCard[] {
    return moduleId === MIXED_MODULE_ID
      ? this.deps.engine.allCards()
      : this.deps.engine.get(moduleId)?.cards ?? [];
  }

  async start(
    telegramId: number,
    chatId: number,
    moduleId: string,
    rng: () => number = Math.random,
  ): Promise<TurnResult | null> {
    const cards = this.pool(moduleId);
    if (cards.length === 0) return null;
    await this.deps.sessions.abandonActive(telegramId);

    const user = await this.deps.users.getByTelegramId(telegramId);
    const speakOptIn = user?.speakOptIn ?? false;
    const length = user?.sessionLength ?? DEFAULT_SESSION_LENGTH;

    const prog = await this.deps.progress.forCards(telegramId, cards.map((c) => c.id));
    const chosen = orderByMastery(cards, prog, rng).slice(0, Math.min(length, cards.length));
    const exercises = chosen.map((card) => {
      const kind = pickKind(card, masteryOf(prog.get(card.id)), { speakOptIn, rng });
      return buildExercise(card, cards, kind, { rng });
    });

    const session = await this.deps.sessions.create(telegramId, chatId, moduleId, exercises);
    const view = renderQuestion(await this.viewOf(session), session.exercises[0]!);
    return { session, view };
  }

  /** Build the renderer view-model from a session (+ optional flash). */
  private async viewOf(
    s: StudySession,
    flash?: QuestionView['flash'],
  ): Promise<QuestionView> {
    const stats = await this.deps.stats.get(s.telegramId);
    const v: QuestionView = {
      sessionId: s._id.toString(),
      index: s.current,
      total: s.exercises.length,
      xpTotal: stats?.xp ?? 0,
      correctCount: s.correctCount,
      builderPicked: s.builderPicked,
    };
    if (flash) v.flash = flash;
    return v;
  }

  /** Load the active session iff it matches the callback's session id. */
  private async activeById(telegramId: number, sid: string): Promise<StudySession | null> {
    if (!Types.ObjectId.isValid(sid)) return null;
    const s = await this.deps.sessions.findActive(telegramId);
    if (!s || s._id.toString() !== sid) return null;
    return s;
  }

  async submitChoice(
    telegramId: number,
    sid: string,
    optionIndex: number,
  ): Promise<TurnResult | null> {
    const s = await this.activeById(telegramId, sid);
    if (!s || s.phase !== 'question') return null;
    const ex = s.exercises[s.current];
    if (!ex || (ex.kind !== 'choice' && ex.kind !== 'cloze')) return null;
    return this.evaluate(s, ex, optionIndex === ex.correctIndex);
  }

  /** next from the feedback view. */
  async next(telegramId: number, sid: string): Promise<TurnResult | null> {
    const s = await this.activeById(telegramId, sid);
    if (!s || s.phase !== 'feedback') return null;
    const applied = await this.deps.sessions.advance(s._id, {
      correct: false,
      xp: 0,
      expectedCurrent: s.current,
    });
    if (!applied) return null;
    return this.renderCurrent(s._id, telegramId);
  }

  /** Shared outcome path for every exercise kind. Guarded writes first;
   *  progress/XP recorded only when the guard applied (race-safe). */
  private async evaluate(
    s: StudySession,
    ex: Exercise,
    correct: boolean,
    corrected?: string,
  ): Promise<TurnResult | null> {
    if (!correct) {
      let requeue: Exercise | null = null;
      if (!s.requeued.includes(ex.cardId)) {
        const card = this.deps.engine.card(ex.cardId);
        const pool = this.pool(s.moduleId);
        if (card && pool.length >= 2) requeue = buildExercise(card, pool, 'choice', {});
      }
      const applied = await this.deps.sessions.markWrong(s._id, ex.cardId, requeue);
      if (!applied) return null;
      await this.deps.progress.record(s.telegramId, ex.cardId, false);
      const fresh = await this.deps.sessions.findById(s._id);
      if (!fresh) return null;
      const exForFeedback: Exercise = { ...ex, feedback: ex.feedback ?? {} };
      return { session: fresh, view: renderFeedback(await this.viewOf(fresh), exForFeedback) };
    }

    const xp = xpFor(ex.kind);
    const applied = await this.deps.sessions.advance(s._id, {
      correct: true,
      xp,
      expectedCurrent: s.current,
    });
    if (!applied) return null;
    await this.deps.progress.record(s.telegramId, ex.cardId, true);
    await this.deps.stats.addXp(s.telegramId, xp);
    const flash: QuestionView['flash'] = corrected
      ? { correct: true, xp, corrected }
      : { correct: true, xp };
    return this.renderCurrent(s._id, s.telegramId, flash);
  }

  /** Render the current question, or the finish screen when past the end. */
  private async renderCurrent(
    sessionId: Types.ObjectId,
    telegramId: number,
    flash?: QuestionView['flash'],
  ): Promise<TurnResult | null> {
    const s = await this.deps.sessions.findById(sessionId);
    if (!s) return null;
    const ex = s.exercises[s.current];
    if (ex) {
      return { session: s, view: renderQuestion(await this.viewOf(s, flash), ex) };
    }
    // done
    await this.deps.stats.addXp(telegramId, COMPLETION_BONUS);
    await this.deps.sessions.complete(s._id, 'completed');
    const missedWords = [...new Set(s.missed)]
      .map((id) => this.deps.engine.card(id))
      .filter((c): c is QuizCard => !!c)
      .map((c) => `${c.indonesian} — ${c.english}`);
    const view = renderFinish(
      {
        correctCount: s.correctCount,
        total: s.exercises.length,
        xpEarned: s.xpEarned + COMPLETION_BONUS,
        missedWords,
      },
    );
    return { session: s, view };
  }

  async tapTile(telegramId: number, sid: string, tileIndex: number): Promise<TurnResult | null> {
    const s = await this.activeById(telegramId, sid);
    if (!s || s.phase !== 'question') return null;
    const ex = s.exercises[s.current];
    if (!ex || ex.kind !== 'builder' || !ex.tiles) return null;
    if (tileIndex < 0 || tileIndex >= ex.tiles.length || s.builderPicked.includes(tileIndex)) return null;

    const picked = [...s.builderPicked, tileIndex];
    if (picked.length < ex.tiles.length) {
      await this.deps.sessions.pushTile(s._id, tileIndex);
      const fresh = await this.deps.sessions.findById(s._id);
      if (!fresh) return null;
      return { session: fresh, view: renderQuestion(await this.viewOf(fresh), fresh.exercises[fresh.current]!) };
    }
    // last tile placed → evaluate the full sentence
    const built = picked.map((i) => ex.tiles![i]).join(' ');
    const correct = matchAnswer(built, ex.answer) !== 'wrong';
    return this.evaluate(s, ex, correct);
  }

  async undoTile(telegramId: number, sid: string): Promise<TurnResult | null> {
    const s = await this.activeById(telegramId, sid);
    if (!s || s.phase !== 'question') return null;
    const ex = s.exercises[s.current];
    if (!ex || ex.kind !== 'builder' || s.builderPicked.length === 0) return null;
    await this.deps.sessions.popTile(s._id);
    const fresh = await this.deps.sessions.findById(s._id);
    if (!fresh) return null;
    return { session: fresh, view: renderQuestion(await this.viewOf(fresh), fresh.exercises[fresh.current]!) };
  }

  /** typed text from chat; null = not ours, let conversation logic handle it.
   *  Also accepts typed input for speak exercises (Deepgram-failure fallback). */
  async submitTyped(telegramId: number, text: string): Promise<TurnResult | null> {
    const s = await this.deps.sessions.findActive(telegramId);
    if (!s || s.phase !== 'question') return null;
    const ex = s.exercises[s.current];
    if (!ex || (ex.kind !== 'type' && ex.kind !== 'speak')) return null;
    const m = matchAnswer(text, ex.answer);
    return this.evaluate(s, ex, m !== 'wrong', m === 'close' ? ex.answer : undefined);
  }

  /** voice transcript; null = not ours. */
  async submitSpoken(telegramId: number, transcript: string): Promise<TurnResult | null> {
    const s = await this.deps.sessions.findActive(telegramId);
    if (!s || s.phase !== 'question') return null;
    const ex = s.exercises[s.current];
    if (!ex || ex.kind !== 'speak') return null;

    let m = matchAnswer(transcript, ex.answer);
    if (m === 'wrong' && this.deps.judge) {
      try {
        if (await this.deps.judge.judgeSpokenAnswer(transcript, ex.answer)) m = 'close';
      } catch (err) {
        this.deps.logger.warn({ err }, 'speak judge failed; falling back to strict match');
      }
    }
    return this.evaluate(s, ex, m !== 'wrong', m === 'close' ? ex.answer : undefined);
  }

  /** Re-render the current question/feedback after the card message was re-sent. */
  async refocus(telegramId: number): Promise<TurnResult | null> {
    const s = await this.deps.sessions.findActive(telegramId);
    if (!s) return null;
    const ex = s.exercises[s.current];
    if (!ex) return null;
    const view =
      s.phase === 'feedback'
        ? renderFeedback(await this.viewOf(s), { ...ex, feedback: ex.feedback ?? {} })
        : renderQuestion(await this.viewOf(s), ex);
    return { session: s, view };
  }

  /** Sweep idle sessions: mark expired and return finish views for the handler to render. */
  async expireStale(maxAgeMs: number): Promise<TurnResult[]> {
    const stale = await this.deps.sessions.findStale(new Date(Date.now() - maxAgeMs));
    const out: TurnResult[] = [];
    for (const s of stale) {
      await this.deps.sessions.complete(s._id, 'expired');
      const view: CardView = {
        text: `⌛ Session expired.\n✅ ${s.correctCount}/${s.exercises.length} · ⭐ +${s.xpEarned} XP`,
        buttons: [[{ text: '▶️ Practice again', data: 'p:again' }]],
        finished: true,
      };
      out.push({ session: s, view });
    }
    return out;
  }
}
