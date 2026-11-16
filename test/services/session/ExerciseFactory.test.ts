// test/services/session/ExerciseFactory.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  masteryOf, eligibleKinds, pickKind, buildExercise, orderByMastery,
  dueAt, countDue, pickSessionCards, DAY_MS, type DueFields,
} from '../../../src/services/session/ExerciseFactory.js';
import type { QuizCard } from '../../../src/services/quiz/types.js';

const SENT = { id: 's1', text: 'Saya mau makan nasi goreng', blank: 'makan', en: 'I want to eat fried rice' };
const card = (over: Partial<QuizCard> = {}): QuizCard => ({
  id: 'c1', indonesian: 'makan', english: 'to eat', audio: 'a.ogg',
  note: { en: 'note-en' }, sentences: [SENT], ...over,
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
  const ex = buildExercise(card(), pool, 'choice', { rng: () => 0.5 });
  assert.equal(ex.kind, 'choice');
  assert.equal(ex.options!.length, 4);
  assert.equal(ex.options![ex.correctIndex!], 'to eat');
  assert.equal(ex.audioFile, 'a.ogg');
  assert.equal(ex.answer, 'to eat');
  assert.equal(ex.feedback.note, 'note-en');
});

test('buildExercise cloze: blanks the word, options contain it', () => {
  const ex = buildExercise(card(), pool, 'cloze', { rng: () => 0.5 });
  assert.ok(ex.prompt.includes('___'));
  assert.ok(!ex.prompt.includes('makan'));
  assert.equal(ex.options![ex.correctIndex!], 'makan');
  assert.equal(ex.answer, 'makan');
});

test('buildExercise cloze: blanks a punctuated occurrence (no answer leak)', () => {
  const c = card({ sentences: [{ id: 's2', text: 'Dia makan.', blank: 'makan', en: 'He eats.' }] });
  const ex = buildExercise(c, pool, 'cloze', { rng: () => 0.5 });
  assert.ok(ex.prompt.includes('___'));
  assert.ok(!ex.prompt.toLowerCase().includes('makan'));
});

test('buildExercise builder: tiles are a permutation of the sentence words', () => {
  const ex = buildExercise(card(), pool, 'builder', { rng: () => 0.5 });
  assert.deepEqual([...ex.tiles!].sort(), ['Saya', 'goreng', 'makan', 'mau', 'nasi'].sort());
  assert.equal(ex.answer, 'Saya mau makan nasi goreng');
});

test('buildExercise type/speak: EN→ID recall', () => {
  const ty = buildExercise(card(), pool, 'type', { rng: () => 0.5 });
  assert.equal(ty.answer, 'makan');
  assert.ok(ty.prompt.includes('to eat'));
  const sp = buildExercise(card(), pool, 'speak', { rng: () => 0.5 });
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
  const ex = buildExercise(card(), tiny, 'choice', { rng: () => 0.5 });
  assert.equal(ex.options!.length, 2);
  assert.equal(ex.options![ex.correctIndex!], 'to eat');
});

test('buildExercise escapes HTML-significant chars in prompts', () => {
  const c: QuizCard = { id: 'c1', indonesian: 'makan', english: 'a < b & c' };
  const ty = buildExercise(c, pool, 'type', { rng: () => 0.5 });
  assert.ok(ty.prompt.includes('a &lt; b &amp; c'));
  assert.ok(!ty.prompt.includes('a < b'));
});

const NOW = Date.UTC(2026, 10, 16);
const seenP = (correct: number, daysAgo: number, lastResult: 'correct' | 'wrong' = 'correct'): DueFields => ({
  seen: correct + 1, correct, lastResult, lastSeenAt: new Date(NOW - daysAgo * DAY_MS),
});
const deck = (n: number): QuizCard[] =>
  Array.from({ length: n }, (_, i) => ({ id: `k${i + 1}`, indonesian: `w${i + 1}`, english: `e${i + 1}` }));
const mid = () => 0.5;
const ids = (slots: { card: QuizCard; role: string }[], role: string) =>
  slots.filter((s) => s.role === role).map((s) => s.card.id);

test('dueAt: null when unseen, 0 on lapse, growing interval by correct count', () => {
  assert.equal(dueAt(undefined), null);
  assert.equal(dueAt({ seen: 0, correct: 0 }), null);
  assert.equal(dueAt(seenP(5, 0, 'wrong')), 0);
  assert.equal(dueAt({ seen: 1, correct: 1, lastResult: 'correct' }), 0); // no timestamp
  assert.equal(dueAt(seenP(1, 0)), NOW + 1 * DAY_MS);
  assert.equal(dueAt(seenP(2, 0)), NOW + 3 * DAY_MS);
  assert.equal(dueAt(seenP(3, 0)), NOW + 7 * DAY_MS);
  assert.equal(dueAt(seenP(9, 0)), NOW + 21 * DAY_MS);
});

test('countDue counts seen cards due by the cutoff, never unseen ones', () => {
  const prog = [seenP(1, 2), seenP(1, 0), seenP(4, 1), seenP(2, 0, 'wrong'), { seen: 0, correct: 0 }];
  assert.equal(countDue(prog, NOW), 2);            // overdue + lapse
  assert.equal(countDue(prog, NOW + DAY_MS), 3);   // + the one seen today
});

test('pickSessionCards: caps new words at 30% and takes them in content order', () => {
  const cards = deck(20);
  const prog = new Map(cards.slice(0, 10).map((c) => [c.id, seenP(1, 5)]));
  const slots = pickSessionCards(cards, prog, 10, mid);
  assert.deepEqual(ids(slots, 'intro'), ['k11', 'k12', 'k13']);
  assert.deepEqual(ids(slots, 'new'), ['k11', 'k12', 'k13']);
  assert.equal(ids(slots, 'review').length, 7);
  assert.equal(pickSessionCards(cards, prog, 5, mid).filter((s) => s.role === 'intro').length, 2);
  assert.equal(pickSessionCards(deck(40), new Map(deck(40).slice(0, 30).map((c) => [c.id, seenP(1, 5)])), 20, mid)
    .filter((s) => s.role === 'intro').length, 6);
});

test('pickSessionCards: every intro precedes its quiz with another card between', () => {
  const cards = deck(20);
  const prog = new Map(cards.slice(0, 10).map((c) => [c.id, seenP(1, 5)]));
  const slots = pickSessionCards(cards, prog, 10, mid);
  for (const id of ids(slots, 'intro')) {
    const intro = slots.findIndex((s) => s.role === 'intro' && s.card.id === id);
    const quiz = slots.findIndex((s) => s.role === 'new' && s.card.id === id);
    assert.ok(quiz - intro >= 2, `${id}: intro ${intro}, quiz ${quiz}`);
  }
});

test('pickSessionCards: lapses first, then most overdue', () => {
  const cards = deck(12);
  const prog = new Map<string, DueFields>(cards.slice(0, 10).map((c, i) => [c.id, seenP(1, i + 2)]));
  prog.set('k1', seenP(6, 0, 'wrong')); // missed a moment ago
  const slots = pickSessionCards(cards, prog, 5, mid);
  // newCap 2 → 3 review slots: the lapse, then k10 and k9 (seen longest ago)
  assert.deepEqual(ids(slots, 'review').sort(), ['k1', 'k10', 'k9']);
});

test('pickSessionCards: too few due cards → early reviews, then extra new words', () => {
  const cards = deck(20);
  const prog = new Map(cards.slice(0, 4).map((c) => [c.id, seenP(4, 0)])); // none due
  const slots = pickSessionCards(cards, prog, 10, mid);
  assert.equal(ids(slots, 'review').length, 4);                 // early reviews
  assert.deepEqual(ids(slots, 'intro'), ['k5', 'k6', 'k7', 'k8', 'k9']);
  assert.equal(ids(slots, 'new').length, 6);                    // 5 firsts + 1 repeat
  assert.equal(slots.filter((s) => s.role !== 'intro').length, 10);
});

test('pickSessionCards: new user gets half the length in words, each quizzed twice', () => {
  const slots = pickSessionCards(deck(7), new Map(), 10, mid);
  assert.equal(
    slots.map((s) => (s.role === 'intro' ? `${s.card.id}i` : s.card.id)).join(' '),
    'k1i k2i k1 k3i k2 k4i k3 k5i k4 k5 k1 k2 k3 k4 k5',
  );
});

test('pickSessionCards: small pools give a shorter session; no fresh cards → no intros', () => {
  const small = pickSessionCards(deck(2), new Map(), 10, mid);
  assert.equal(small.filter((s) => s.role === 'intro').length, 2);
  assert.equal(small.filter((s) => s.role === 'new').length, 4);
  const cards = deck(3);
  const allSeen = pickSessionCards(cards, new Map(cards.map((c) => [c.id, seenP(1, 5)])), 10, mid);
  assert.deepEqual(allSeen.map((s) => s.role), ['review', 'review', 'review']);
});
