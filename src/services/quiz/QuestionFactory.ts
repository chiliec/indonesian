import type { QuizCard, Question, QuestionType } from './types.js';

const ALL_TYPES: QuestionType[] = ['audio-en', 'audio-id', 'id-en', 'en-id'];

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

  const correct = answerOf(type, card);

  const distractors: string[] = [];
  const seen = new Set<string>([correct]);
  for (const c of shuffle(pool, rng)) {
    if (c.id === card.id) continue;
    const v = answerOf(type, c);
    if (seen.has(v)) continue;
    seen.add(v);
    distractors.push(v);
    if (distractors.length === 3) break;
  }

  const options = shuffle([correct, ...distractors], rng);
  const correctIndex = options.indexOf(correct);

  const q: Question = {
    cardId: card.id,
    type,
    promptText: buildPrompt(type, card),
    options,
    correctIndex,
    explanation: `${card.indonesian} = ${card.english}`,
  };
  if ((type === 'audio-en' || type === 'audio-id') && card.audio) q.audioFile = card.audio;
  return q;
}
