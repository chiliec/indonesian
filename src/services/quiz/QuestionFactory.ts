import type { QuizCard, Question, QuestionType } from './types.js';

const ALL_TYPES: QuestionType[] = ['audio-en', 'audio-id', 'id-en', 'en-id'];

// Telegram quiz-poll field limits. Long phrase/sentence cards would otherwise
// make sendPoll reject the whole question with a 400, so clamp defensively.
const POLL_QUESTION_MAX = 300;
const POLL_OPTION_MAX = 100;
const POLL_EXPLANATION_MAX = 200;

function clamp(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max);
}

export interface BuildOpts {
  type?: QuestionType;
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

export function eligibleTypes(card: QuizCard): QuestionType[] {
  return card.audio ? [...ALL_TYPES] : ALL_TYPES.filter((t) => !t.startsWith('audio'));
}

/** the field the learner must choose, given the question type */
function answerOf(type: QuestionType, c: QuizCard): string {
  return type === 'audio-en' || type === 'id-en' ? c.english : c.indonesian;
}

function buildPrompt(type: QuestionType, card: QuizCard): string {
  switch (type) {
    case 'audio-en':
      return 'What does this mean?';
    case 'audio-id':
      return 'Which word did you hear?';
    case 'id-en':
      return `What does "${card.indonesian}" mean?`;
    case 'en-id':
      return `How do you say "${card.english}"?`;
  }
}

export function build(card: QuizCard, pool: readonly QuizCard[], opts: BuildOpts = {}): Question {
  const rng = opts.rng ?? Math.random;
  const eligible = eligibleTypes(card);
  const type =
    opts.type && eligible.includes(opts.type)
      ? opts.type
      : eligible[Math.floor(rng() * eligible.length)]!;

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
  if ((type === 'audio-en' || type === 'audio-id') && card.audio) q.audioFile = card.audio;
  return q;
}
