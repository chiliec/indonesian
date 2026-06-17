import type { QuizEngine } from './quiz/QuizEngine.js';
import type { QuizCard } from './quiz/types.js';
import { QuizProgressRepo, type QuizProgress } from '../db/quizProgress.js';

/** synthetic module id: draws questions from every module's cards. */
export const MIXED_MODULE_ID = 'mixed';

export interface QuizDeps {
  engine: QuizEngine;
  progress: QuizProgressRepo;
}

export interface ModuleMastery {
  id: string;
  title: string;
  pct: number;
}

/** Mastery percentages for the progress view and module picker. */
export class QuizService {
  constructor(public readonly deps: QuizDeps) {}

  async moduleList(telegramId: number): Promise<ModuleMastery[]> {
    const masteredPct = (cards: QuizCard[], prog: Map<string, QuizProgress>): number => {
      let mastered = 0;
      for (const c of cards) if ((prog.get(c.id)?.correct ?? 0) > 0) mastered++;
      return cards.length ? Math.round((mastered / cards.length) * 100) : 0;
    };

    const out: ModuleMastery[] = [];
    for (const m of this.deps.engine.list()) {
      const prog = await this.deps.progress.forCards(telegramId, m.cards.map((c) => c.id));
      out.push({ id: m.id, title: m.title.en, pct: masteredPct(m.cards, prog) });
    }

    const all = this.deps.engine.allCards();
    const allProg = await this.deps.progress.forCards(telegramId, all.map((c) => c.id));
    out.unshift({
      id: MIXED_MODULE_ID,
      title: '🎲 Mixed (all words)',
      pct: masteredPct(all, allProg),
    });
    return out;
  }
}
