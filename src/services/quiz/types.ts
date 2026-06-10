export interface QuizSentence {
  id: string;
  text: string;
  /** the word hidden in cloze mode (must appear as a whole word in text) */
  blank: string;
  en: string;
  audio?: string;
}

export interface CardNote {
  en: string;
  ru: string;
}

export interface QuizCard {
  id: string;
  indonesian: string;
  english: string;
  audio?: string;
  note?: CardNote;
  sentences?: QuizSentence[];
}

export interface QuizModule {
  id: string;
  title: { en: string; ru: string };
  cards: QuizCard[];
}

export type QuestionType = 'listen' | 'produce' | 'text';

export interface Question {
  cardId: string;
  type: QuestionType;
  /** poll question text */
  promptText: string;
  /** OGG filename, present only for the 'listen' mode */
  audioFile?: string;
  /** answer options (up to 4; fewer only for very small modules) */
  options: string[];
  /** index into options of the correct answer */
  correctIndex: number;
  /** poll explanation shown after answering */
  explanation: string;
}
