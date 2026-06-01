import type { QuizCard, Question, QuestionType } from './types.js';

// Telegram quiz-poll field limits. Long phrase/sentence cards would otherwise
// make sendPoll reject the whole question with a 400, so clamp defensively.
const POLL_QUESTION_MAX = 300;
const POLL_OPTION_MAX = 100;
const POLL_EXPLANATION_MAX = 200;

// Fraction of mastered audio cards surfaced as recall ("produce") questions.
const PRODUCE_RATE = 1 / 5;

function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export interface BuildOpts {
  /** Caller-specified mode override; ignored if ineligible for the card. */
  type?: QuestionType;
  /** Whether the learner has already gotten this card right at least once. */
  isMastered?: boolean;
  rng?: () => number;
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

/** Modes a card can render: listen needs audio; text & produce work without it. */
export function eligibleTypes(card: QuizCard): QuestionType[] {
  return card.audio ? ['listen', 'produce', 'text'] : ['text', 'produce'];
}

/** Default mode selection: audioless -> text; mastered audio -> produce ~1/5; else listen. */
function selectType(card: QuizCard, isMastered: boolean, rng: () => number): QuestionType {
  if (!card.audio) return 'text';
  if (isMastered && rng() < PRODUCE_RATE) return 'produce';
  return 'listen';
}

/** The field the learner must choose, given the mode. */
function answerOf(type: QuestionType, c: QuizCard): string {
  return type === 'produce' ? c.indonesian : c.english;
}

function buildPrompt(type: QuestionType, card: QuizCard): string {
  switch (type) {
    case 'listen':
      return 'What does this mean?';
    case 'text':
      return `What does "${card.indonesian}" mean?`;
    case 'produce':
      return `How do you say "${card.english}"?`;
  }
}

export function build(card: QuizCard, pool: readonly QuizCard[], opts: BuildOpts = {}): Question {
  const rng = opts.rng ?? Math.random;
  const eligible = eligibleTypes(card);
  const type =
    opts.type && eligible.includes(opts.type)
      ? opts.type
      : selectType(card, opts.isMastered ?? false, rng);

  // Clamp option values before deduping so truncation can't yield duplicates.
  const correct = clamp(answerOf(type, card), POLL_OPTION_MAX);

  const distractors: string[] = [];
  const seen = new Set<string>([correct]);
  for (const c of shuffle(pool, rng)) {
    if (c.id === card.id) continue;
    const v = clamp(answerOf(type, c), POLL_OPTION_MAX);
    if (seen.has(v)) continue;
    seen.add(v);
    distractors.push(v);
    if (distractors.length === 3) break;
  }

  const options = shuffle([correct, ...distractors], rng);
  const correctIndex = options.indexOf(correct);

  if (options.length < 2) {
    throw new Error(`cannot build question for ${card.id}: pool too small (${options.length} option(s))`);
  }
  if (correctIndex < 0) {
    throw new Error(`correct answer missing from options for ${card.id}`);
  }

  const q: Question = {
    cardId: card.id,
    type,
    promptText: clamp(buildPrompt(type, card), POLL_QUESTION_MAX),
    options,
    correctIndex,
    explanation: clamp(`${card.indonesian} = ${card.english}`, POLL_EXPLANATION_MAX),
  };
  if (type === 'listen' && card.audio) q.audioFile = card.audio;
  return q;
}
