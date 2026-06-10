import type { ExerciseKind } from './types.js';

export const BASE_XP = 10;
export const COMPLETION_BONUS = 25;

const MULT: Record<ExerciseKind, number> = {
  choice: 1.0,
  cloze: 1.2,
  builder: 1.5,
  type: 1.7,
  speak: 2.0,
};

export function xpFor(kind: ExerciseKind): number {
  return Math.round(BASE_XP * MULT[kind]);
}
