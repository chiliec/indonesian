export type ExerciseKind = 'choice' | 'cloze' | 'builder' | 'type' | 'speak';

export interface ExerciseFeedback {
  /** example sentence in Indonesian (from card.sentences[0]) */
  sentence?: string;
  sentenceEn?: string;
  /** locale-resolved usage note */
  note?: string;
}

export interface Exercise {
  cardId: string;
  kind: ExerciseKind;
  /** question line shown in the card (already locale-resolved) */
  prompt: string;
  /** choice/cloze: answer options */
  options?: string[];
  /** choice/cloze: index into options */
  correctIndex?: number;
  /** builder: shuffled word tiles */
  tiles?: string[];
  /** canonical expected answer (word, meaning, or full sentence) */
  answer: string;
  /** OGG to play above the card (listen variant of choice) */
  audioFile?: string;
  feedback: ExerciseFeedback;
}

export interface Button {
  text: string;
  data: string;
}

/** What the handler must put on screen after any engine turn. */
export interface CardView {
  /** HTML body of the session-card message */
  text: string;
  buttons: Button[][];
  /** OGG to send as a voice message above the card (undefined = delete any) */
  audioFile?: string;
  finished: boolean;
}
