import { z } from 'zod';
import type { QuizCard, QuizSentence } from '../../src/services/quiz/types.js';

const MAX_WORDS = 8;

const GenSentence = z
  .object({
    text: z.string().min(1),
    blank: z.string().min(1),
    en: z.string().min(1),
  })
  .refine((s) => s.text.split(/\s+/).length <= MAX_WORDS, { message: `sentence longer than ${MAX_WORDS} words` })
  .refine(
    (s) => new RegExp(`\\b${s.blank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s.text),
    { message: 'blank must appear as a whole word in text' },
  );

export const GeneratedSchema = z.object({
  note: z.object({ en: z.string().min(1), ru: z.string().min(1) }),
  sentences: z.array(GenSentence).min(2).max(3),
});

export type Generated = z.infer<typeof GeneratedSchema>;

export function buildEnrichmentPrompt(card: QuizCard): string {
  return `You are creating beginner Indonesian learning content.

Target word/phrase: "${card.indonesian}" (English: "${card.english}")

Produce STRICT JSON (no markdown fence, no commentary) with this exact shape:
{
  "note": { "en": "<one-line usage note in English: register, common confusion, related words>",
            "ru": "<the same note in Russian>" },
  "sentences": [
    { "text": "<natural beginner-level Indonesian sentence of at most 8 words using the target word>",
      "blank": "<the exact target word as it appears in the sentence>",
      "en": "<English translation>" }
  ]
}

Rules:
- 2 or 3 sentences, each at most 8 words, everyday Bali/Indonesia situations.
- "blank" must appear verbatim as a whole word inside "text".
- Use only common beginner vocabulary around the target word.`;
}

/** merge validated generation into a card (audio filenames map 1:1 to sentences). */
export function applyEnrichment(card: QuizCard, gen: Generated, audioFiles: (string | null)[]): QuizCard {
  const sentences: QuizSentence[] = gen.sentences.map((s, i) => {
    const out: QuizSentence = { id: `${card.id}-s${i + 1}`, text: s.text, blank: s.blank, en: s.en };
    const audio = audioFiles[i];
    if (audio) out.audio = audio;
    return out;
  });
  return { ...card, note: gen.note, sentences };
}
