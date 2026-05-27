import type { RawNote } from './parseApkg.js';

export interface QuizCard {
  id: string;
  indonesian: string;
  english: string;
  audio?: string;
}

export interface FieldMapping {
  /** zero-based field index for the Indonesian term (default 0) */
  indonesianIdx?: number;
  /** zero-based field index for the English meaning (default 1) */
  englishIdx?: number;
}

const SOUND_RE = /\[sound:([^\]]+)\]/;
const HTML_RE = /<[^>]+>/g;

function clean(s: string | undefined): string {
  return (s ?? '').replace(HTML_RE, '').replace(/&nbsp;/g, ' ').trim();
}

function findAudio(fields: string[]): string | undefined {
  for (const f of fields) {
    const m = SOUND_RE.exec(f);
    if (m) return m[1];
  }
  return undefined;
}

export function extractCards(
  moduleId: string,
  notes: RawNote[],
  mapping: FieldMapping,
): { cards: QuizCard[]; skipped: number } {
  const idIdx = mapping.indonesianIdx ?? 0;
  const enIdx = mapping.englishIdx ?? 1;
  const cards: QuizCard[] = [];
  let skipped = 0;
  let seq = 0;

  for (const note of notes) {
    const indonesian = clean(note.fields[idIdx]);
    const english = clean(note.fields[enIdx]);
    if (!indonesian || !english) {
      skipped++;
      continue;
    }
    seq++;
    const card: QuizCard = {
      id: `${moduleId}-${String(seq).padStart(4, '0')}`,
      indonesian,
      english,
    };
    const audio = findAudio(note.fields);
    if (audio) card.audio = audio;
    cards.push(card);
  }

  return { cards, skipped };
}
