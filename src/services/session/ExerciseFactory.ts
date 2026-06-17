import type { QuizCard, QuizSentence } from '../quiz/types.js';
import type { QuizProgress } from '../../db/quizProgress.js';
import type { Exercise, ExerciseKind } from './types.js';
import { escapeHtml } from './html.js';

/** 0 unseen · 1 last answer wrong · else lifetime correct count capped at 4. */
export function masteryOf(p?: Pick<QuizProgress, 'seen' | 'correct' | 'lastResult'>): number {
  if (!p || p.seen === 0) return 0;
  if (p.lastResult === 'wrong') return 1;
  return Math.min(4, p.correct);
}

/** mastery bands per spec; order doubles as difficulty order. */
const BANDS: Record<ExerciseKind, [number, number]> = {
  choice: [0, 1],
  cloze: [1, 2],
  builder: [2, 3],
  type: [2, 4],
  speak: [3, 4],
};
const DIFFICULTY: ExerciseKind[] = ['choice', 'cloze', 'builder', 'type', 'speak'];

const MAX_BUILDER_TILES = 8;
const MAX_DISTRACTORS = 3;

export interface KindOpts {
  speakOptIn: boolean;
  rng?: () => number;
}

function usableSentences(card: QuizCard, kind: 'cloze' | 'builder'): QuizSentence[] {
  const ss = card.sentences ?? [];
  if (kind === 'builder') return ss.filter((s) => s.text.split(/\s+/).length <= MAX_BUILDER_TILES);
  return ss;
}

/** in-band kinds the card can actually support; never empty (choice fallback). */
export function eligibleKinds(card: QuizCard, mastery: number, opts: KindOpts): ExerciseKind[] {
  const supported = (k: ExerciseKind): boolean => {
    if (k === 'cloze' || k === 'builder') return usableSentences(card, k).length > 0;
    if (k === 'speak') return opts.speakOptIn;
    return true;
  };
  const out = DIFFICULTY.filter(
    (k) => mastery >= BANDS[k][0] && mastery <= BANDS[k][1] && supported(k),
  );
  return out.length ? out : ['choice'];
}

/** weighted pick favoring harder (later) kinds: weights 1,2,3,... */
export function pickKind(card: QuizCard, mastery: number, opts: KindOpts): ExerciseKind {
  const rng = opts.rng ?? Math.random;
  const eligible = eligibleKinds(card, mastery, opts);
  const total = (eligible.length * (eligible.length + 1)) / 2;
  let roll = rng() * total;
  for (let i = 0; i < eligible.length; i++) {
    roll -= i + 1;
    if (roll < 0) return eligible[i]!;
  }
  return eligible[eligible.length - 1]!;
}

function shuffle<T>(arr: readonly T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = a[i]!;
    a[i] = a[j]!;
    a[j] = tmp;
  }
  return a;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface BuildExOpts {
  rng?: () => number;
}

/** Build distractor options around `correct`, drawing `field` from other pool cards. */
function buildOptions(
  correct: string,
  cardId: string,
  pool: readonly QuizCard[],
  field: 'english' | 'indonesian',
  rng: () => number,
): { options: string[]; correctIndex: number } {
  const seen = new Set<string>([correct]);
  const distractors: string[] = [];
  for (const c of shuffle(pool, rng)) {
    if (c.id === cardId) continue;
    const v = c[field];
    if (seen.has(v)) continue;
    seen.add(v);
    distractors.push(v);
    if (distractors.length === MAX_DISTRACTORS) break;
  }
  if (distractors.length === 0) {
    throw new Error(`no distinct distractors for card ${cardId} (all pool values match "${correct}")`);
  }
  const options = shuffle([correct, ...distractors], rng);
  const correctIndex = options.indexOf(correct);
  return { options, correctIndex };
}

function feedbackOf(card: QuizCard): Exercise['feedback'] {
  const s = card.sentences?.[0];
  const fb: Exercise['feedback'] = {};
  if (s) {
    fb.sentence = s.text;
    fb.sentenceEn = s.en;
  }
  if (card.note) fb.note = card.note.en;
  return fb;
}

export function buildExercise(
  card: QuizCard,
  pool: readonly QuizCard[],
  kind: ExerciseKind,
  opts: BuildExOpts,
): Exercise {
  const rng = opts.rng ?? Math.random;
  const feedback = feedbackOf(card);
  const base = { cardId: card.id, kind, feedback };

  switch (kind) {
    case 'choice': {
      const { options, correctIndex } = buildOptions(card.english, card.id, pool, 'english', rng);
      const prompt = card.audio
        ? '🔊 What does this mean?'
        : `What does "${escapeHtml(card.indonesian)}" mean?`;
      const ex: Exercise = { ...base, prompt, options, correctIndex, answer: card.english };
      if (card.audio) ex.audioFile = card.audio;
      return ex;
    }
    case 'cloze': {
      const s = usableSentences(card, 'cloze')[0];
      if (!s) throw new Error(`card ${card.id} has no sentences for cloze`);
      const blanked = s.text.replace(
        new RegExp(`\\b${escapeRegExp(s.blank)}\\b`, 'i'),
        '___',
      );
      // note: distractors may coincide with words still visible in the blanked sentence — accepted trade-off
      const { options, correctIndex } = buildOptions(s.blank, card.id, pool, 'indonesian', rng);
      return {
        ...base,
        prompt: `🧩 Fill the blank:\n<i>${escapeHtml(blanked)}</i>\n(${escapeHtml(s.en)})`,
        options,
        correctIndex,
        answer: s.blank,
      };
    }
    case 'builder': {
      const s = usableSentences(card, 'builder')[0];
      if (!s) throw new Error(`card ${card.id} has no short sentences for builder`);
      const words = s.text.split(/\s+/);
      return {
        ...base,
        prompt: `🧱 Build the sentence:\n"${escapeHtml(s.en)}"`,
        tiles: shuffle(words, rng),
        answer: s.text,
      };
    }
    case 'type': {
      return { ...base, prompt: `✍️ Type it in Indonesian: "${escapeHtml(card.english)}"`, answer: card.indonesian };
    }
    case 'speak': {
      return {
        ...base,
        prompt: `🎤 Say it in Indonesian (send a voice message): "${escapeHtml(card.english)}"`,
        answer: card.indonesian,
      };
    }
  }
}

/** unseen first, then previously-wrong, then mastered; random within each group.
 *  (moved from QuizService so the poll path can be deleted) */
export function orderByMastery(
  cards: QuizCard[],
  prog: Map<string, QuizProgress>,
  rng: () => number = Math.random,
): QuizCard[] {
  const priority = (c: QuizCard): number => {
    const p = prog.get(c.id);
    if (!p || p.seen === 0) return 0;
    if (p.lastResult === 'wrong') return 1;
    return 2;
  };
  return [...cards]
    .map((c) => ({ c, key: priority(c), r: rng() }))
    .sort((a, b) => a.key - b.key || a.r - b.r)
    .map((x) => x.c);
}
