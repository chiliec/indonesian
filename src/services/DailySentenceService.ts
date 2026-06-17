import type { QuizEngine } from './quiz/QuizEngine.js';

export interface DailySentenceEntry {
  sentenceId: string;
  cardId: string;
  text: string;
  en: string;
  /** the vocabulary word this sentence illustrates (parent card's Indonesian) */
  word: string;
}

const SEEN_CAP = 200;

/**
 * Builds an in-memory pool of example sentences from the quiz content and picks
 * one a user has not recently seen. Stateless across users — the caller passes in
 * and persists each user's seen-ID list.
 */
export class DailySentenceService {
  private readonly pool: DailySentenceEntry[];

  constructor(
    engine: QuizEngine,
    private readonly rng: () => number = Math.random,
  ) {
    const byId = new Map<string, DailySentenceEntry>();
    for (const card of engine.allCards()) {
      for (const s of card.sentences ?? []) {
        if (!s.text || !s.en) continue;
        if (byId.has(s.id)) continue;
        byId.set(s.id, {
          sentenceId: s.id,
          cardId: card.id,
          text: s.text,
          en: s.en,
          word: card.indonesian,
        });
      }
    }
    this.pool = Array.from(byId.values());
  }

  get size(): number {
    return this.pool.length;
  }

  /**
   * Pick a sentence the user has not recently seen. When all are seen, the
   * rotation resets (seen list cleared). Returns null only if the pool is empty.
   */
  pick(seenIds: string[] = []): { entry: DailySentenceEntry; nextSeenIds: string[] } | null {
    if (this.pool.length === 0) return null;
    const seen = new Set(seenIds);
    let candidates = this.pool.filter((e) => !seen.has(e.sentenceId));
    let base = seenIds;
    if (candidates.length === 0) {
      candidates = this.pool; // exhausted → reset rotation
      base = [];
    }
    const entry = candidates[Math.floor(this.rng() * candidates.length)]!;
    const cap = Math.min(this.pool.length - 1, SEEN_CAP);
    const nextSeenIds = cap <= 0 ? [] : [...base, entry.sentenceId].slice(-cap);
    return { entry, nextSeenIds };
  }
}
