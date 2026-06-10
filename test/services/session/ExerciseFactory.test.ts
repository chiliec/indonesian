// test/services/session/ExerciseFactory.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  masteryOf, eligibleKinds, pickKind, buildExercise, orderByMastery,
} from '../../../src/services/session/ExerciseFactory.js';
import type { QuizCard } from '../../../src/services/quiz/types.js';

const SENT = { id: 's1', text: 'Saya mau makan nasi goreng', blank: 'makan', en: 'I want to eat fried rice' };
const card = (over: Partial<QuizCard> = {}): QuizCard => ({
  id: 'c1', indonesian: 'makan', english: 'to eat', audio: 'a.ogg',
  note: { en: 'note-en', ru: 'note-ru' }, sentences: [SENT], ...over,
});
const pool: QuizCard[] = [
  card(),
  { id: 'c2', indonesian: 'minum', english: 'to drink' },
  { id: 'c3', indonesian: 'tidur', english: 'to sleep' },
  { id: 'c4', indonesian: 'duduk', english: 'to sit' },
  { id: 'c5', indonesian: 'pergi', english: 'to go' },
];

test('masteryOf: 0 unseen, 1 after wrong, capped correct count otherwise', () => {
  assert.equal(masteryOf(undefined), 0);
  assert.equal(masteryOf({ seen: 0, correct: 0 } as never), 0);
  assert.equal(masteryOf({ seen: 3, correct: 2, lastResult: 'wrong' } as never), 1);
  assert.equal(masteryOf({ seen: 3, correct: 3, lastResult: 'correct' } as never), 3);
  assert.equal(masteryOf({ seen: 9, correct: 9, lastResult: 'correct' } as never), 4);
});

test('eligibleKinds respects bands, sentence availability and speak opt-in', () => {
  assert.deepEqual(eligibleKinds(card(), 0, { speakOptIn: false }), ['choice']);
  assert.deepEqual(eligibleKinds(card(), 2, { speakOptIn: false }), ['cloze', 'builder', 'type']);
  assert.deepEqual(eligibleKinds(card({ sentences: [] }), 2, { speakOptIn: false }), ['type']);
  assert.deepEqual(eligibleKinds(card(), 4, { speakOptIn: true }), ['type', 'speak']);
  assert.deepEqual(eligibleKinds(card(), 4, { speakOptIn: false }), ['type']);
});

test('eligibleKinds falls back to choice when nothing is eligible', () => {
  assert.deepEqual(eligibleKinds(card({ sentences: [] }), 1, { speakOptIn: false }), ['choice']);
});

test('pickKind is deterministic with a fixed rng and favors harder kinds', () => {
  // rng=0.99 → picks the last (hardest) eligible kind
  assert.equal(pickKind(card(), 2, { speakOptIn: false, rng: () => 0.99 }), 'type');
  // rng=0 → picks the first eligible kind
  assert.equal(pickKind(card(), 2, { speakOptIn: false, rng: () => 0 }), 'cloze');
});

test('buildExercise choice: 4 options, correct english present, audio carried', () => {
  const ex = buildExercise(card(), pool, 'choice', { en: true, rng: () => 0.5 });
  assert.equal(ex.kind, 'choice');
  assert.equal(ex.options!.length, 4);
  assert.equal(ex.options![ex.correctIndex!], 'to eat');
  assert.equal(ex.audioFile, 'a.ogg');
  assert.equal(ex.answer, 'to eat');
  assert.equal(ex.feedback.note, 'note-en');
});

test('buildExercise cloze: blanks the word, options contain it', () => {
  const ex = buildExercise(card(), pool, 'cloze', { en: true, rng: () => 0.5 });
  assert.ok(ex.prompt.includes('___'));
  assert.ok(!ex.prompt.includes('makan'));
  assert.equal(ex.options![ex.correctIndex!], 'makan');
  assert.equal(ex.answer, 'makan');
});

test('buildExercise cloze: blanks a punctuated occurrence (no answer leak)', () => {
  const c = card({ sentences: [{ id: 's2', text: 'Dia makan.', blank: 'makan', en: 'He eats.' }] });
  const ex = buildExercise(c, pool, 'cloze', { en: true, rng: () => 0.5 });
  assert.ok(ex.prompt.includes('___'));
  assert.ok(!ex.prompt.toLowerCase().includes('makan'));
});

test('buildExercise builder: tiles are a permutation of the sentence words', () => {
  const ex = buildExercise(card(), pool, 'builder', { en: true, rng: () => 0.5 });
  assert.deepEqual([...ex.tiles!].sort(), ['Saya', 'goreng', 'makan', 'mau', 'nasi'].sort());
  assert.equal(ex.answer, 'Saya mau makan nasi goreng');
});

test('buildExercise type/speak: EN→ID recall', () => {
  const ty = buildExercise(card(), pool, 'type', { en: true, rng: () => 0.5 });
  assert.equal(ty.answer, 'makan');
  assert.ok(ty.prompt.includes('to eat'));
  const sp = buildExercise(card(), pool, 'speak', { en: true, rng: () => 0.5 });
  assert.equal(sp.answer, 'makan');
});

test('orderByMastery: unseen first, then wrong, then mastered', () => {
  const prog = new Map<string, { seen: number; correct: number; lastResult?: 'correct' | 'wrong' }>([
    ['c1', { seen: 2, correct: 2, lastResult: 'correct' }],
    ['c2', { seen: 1, correct: 0, lastResult: 'wrong' }],
  ]);
  const ordered = orderByMastery(pool, prog as never, () => 0.5);
  assert.equal(ordered[ordered.length - 1]!.id, 'c1'); // mastered last
  assert.equal(ordered[ordered.length - 2]!.id, 'c2'); // wrong second-to-last
});

test('buildExercise choice: small pool yields fewer options but stays valid', () => {
  const tiny: QuizCard[] = [card(), { id: 'c2', indonesian: 'minum', english: 'to drink' }];
  const ex = buildExercise(card(), tiny, 'choice', { en: true, rng: () => 0.5 });
  assert.equal(ex.options!.length, 2);
  assert.equal(ex.options![ex.correctIndex!], 'to eat');
});
