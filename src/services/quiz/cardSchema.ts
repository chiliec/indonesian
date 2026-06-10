import { z } from 'zod';

export const SentenceSchema = z
  .object({
    id: z.string().min(1),
    text: z.string().min(1),
    blank: z.string().min(1),
    en: z.string().min(1),
    audio: z.string().optional(),
  })
  .refine(
    (s) => new RegExp(`\\b${s.blank.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s.text),
    { message: 'blank must appear as a whole word in text' },
  );

export const NoteSchema = z.object({ en: z.string().min(1), ru: z.string().min(1) });

export const CardSchema = z.object({
  id: z.string().min(1),
  indonesian: z.string().min(1),
  english: z.string().min(1),
  audio: z.string().optional(),
  note: NoteSchema.optional(),
  sentences: z.array(SentenceSchema).optional(),
});

export const ModuleSchema = z.object({
  id: z.string().min(1),
  title: z.object({ en: z.string().min(1), ru: z.string().min(1) }),
  cards: z.array(CardSchema).min(1),
});
