import type { Types } from 'mongoose';
import type { QuizEngine } from './quiz/QuizEngine.js';
import { build } from './quiz/QuestionFactory.js';
import type { Question, QuizCard } from './quiz/types.js';
import { QuizSessionsRepo, type QuizSession } from '../db/quizSessions.js';
import { QuizProgressRepo, type QuizProgress } from '../db/quizProgress.js';

const SESSION_LENGTH = 10;

export interface QuizDeps {
  engine: QuizEngine;
  sessions: QuizSessionsRepo;
  progress: QuizProgressRepo;
}

export interface ModuleMastery {
  id: string;
  titleEn: string;
  titleRu: string;
  pct: number;
}

export interface AnswerOutcome {
  telegramId: number;
  moduleId: string;
  sessionId: Types.ObjectId;
  correct: boolean;
  done: boolean;
  next: { question: Question; index: number } | null;
  finalScore: number;
  total: number;
  /** cardIds answered wrong (only populated when done) */
  missed: string[];
}

/** unseen first, then previously-wrong, then mastered; random within each group */
function orderByMastery(cards: QuizCard[], prog: Map<string, QuizProgress>): QuizCard[] {
  const priority = (c: QuizCard): number => {
    const p = prog.get(c.id);
    if (!p || p.seen === 0) return 0;
    if (p.lastResult === 'wrong') return 1;
    return 2;
  };
  return [...cards]
    .map((c) => ({ c, key: priority(c), r: Math.random() }))
    .sort((a, b) => (a.key - b.key) || (a.r - b.r))
    .map((x) => x.c);
}

function toQuestion(s: QuizSession['questions'][number]): Question {
  const q: Question = {
    cardId: s.cardId,
    type: s.type as Question['type'],
    promptText: s.promptText,
    options: s.options,
    correctIndex: s.correctIndex,
    explanation: s.explanation,
  };
  if (s.audioFile) q.audioFile = s.audioFile;
  return q;
}

export class QuizService {
  constructor(public readonly deps: QuizDeps) {}

  async moduleList(telegramId: number): Promise<ModuleMastery[]> {
    const out: ModuleMastery[] = [];
    for (const m of this.deps.engine.list()) {
      const prog = await this.deps.progress.forCards(telegramId, m.cards.map((c) => c.id));
      let mastered = 0;
      for (const c of m.cards) if ((prog.get(c.id)?.correct ?? 0) > 0) mastered++;
      const pct = m.cards.length ? Math.round((mastered / m.cards.length) * 100) : 0;
      out.push({ id: m.id, titleEn: m.title.en, titleRu: m.title.ru, pct });
    }
    return out;
  }

  async start(
    telegramId: number,
    moduleId: string,
  ): Promise<{ session: QuizSession; first: Question } | null> {
    const module = this.deps.engine.get(moduleId);
    if (!module) return null;
    await this.deps.sessions.abandonActive(telegramId);

    const prog = await this.deps.progress.forCards(telegramId, module.cards.map((c) => c.id));
    const ordered = orderByMastery(module.cards, prog);
    const chosen = ordered.slice(0, Math.min(SESSION_LENGTH, ordered.length));
    const questions = chosen.map((card) => build(card, module.cards));

    const session = await this.deps.sessions.create(telegramId, moduleId, questions);
    const first = questions[0];
    if (!first) return null;
    return { session, first };
  }

  async recordAnswer(pollId: string, chosenIndex: number): Promise<AnswerOutcome | null> {
    const session = await this.deps.sessions.findByPollId(pollId);
    if (!session) return null;
    const q = session.questions[session.current];
    if (!q) return null;

    const correct = chosenIndex === q.correctIndex;
    await this.deps.progress.record(session.telegramId, q.cardId, correct);
    await this.deps.sessions.recordAnswer(session._id, correct, correct ? null : q.cardId);

    const nextIndex = session.current + 1;
    const nextStored = session.questions[nextIndex];
    const done = !nextStored;
    if (done) await this.deps.sessions.complete(session._id);

    const finalScore = session.score + (correct ? 1 : 0);
    const missed = done ? [...session.missed, ...(correct ? [] : [q.cardId])] : [];

    return {
      telegramId: session.telegramId,
      moduleId: session.moduleId,
      sessionId: session._id,
      correct,
      done,
      next: nextStored ? { question: toQuestion(nextStored), index: nextIndex } : null,
      finalScore,
      total: session.questions.length,
      missed,
    };
  }

}
