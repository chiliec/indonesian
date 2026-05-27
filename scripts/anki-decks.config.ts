import type { FieldMapping } from './anki/extractCards.js';

export interface DeckEntry {
  /** content module id, becomes content/quiz/<moduleId>.yaml */
  moduleId: string;
  titleEn: string;
  titleRu: string;
  /** AnkiWeb shared deck id, used for auto-download. Leave '' to use a local file only. */
  deckId: string;
  /** filename expected under .cache/anki/ (manual download fallback) */
  localFile: string;
  /** per-deck field overrides if a deck's field order differs */
  mapping?: FieldMapping;
}

// NOTE: deck ids are unknown until inspected on AnkiWeb. Fill `deckId` to enable
// auto-download, or drop the .apkg under .cache/anki/<localFile> for manual mode.
export const DECKS: DeckEntry[] = [
  { moduleId: 'module-1', titleEn: 'Module 1', titleRu: 'Модуль 1', deckId: '', localFile: 'module-1.apkg' },
  { moduleId: 'module-2', titleEn: 'Module 2', titleRu: 'Модуль 2', deckId: '', localFile: 'module-2.apkg' },
  { moduleId: 'module-3', titleEn: 'Module 3', titleRu: 'Модуль 3', deckId: '', localFile: 'module-3.apkg' },
  { moduleId: 'module-4', titleEn: 'Module 4', titleRu: 'Модуль 4', deckId: '', localFile: 'module-4.apkg' },
  { moduleId: 'module-5', titleEn: 'Module 5', titleRu: 'Модуль 5', deckId: '', localFile: 'module-5.apkg' },
  { moduleId: 'module-6', titleEn: 'Module 6', titleRu: 'Модуль 6', deckId: '', localFile: 'module-6.apkg' },
  { moduleId: 'module-7', titleEn: 'Module 7', titleRu: 'Модуль 7', deckId: '', localFile: 'module-7.apkg' },
  { moduleId: 'module-8', titleEn: 'Module 8', titleRu: 'Модуль 8', deckId: '', localFile: 'module-8.apkg' },
];
