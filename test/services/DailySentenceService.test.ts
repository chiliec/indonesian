import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DailySentenceService } from '../../src/services/DailySentenceService.js';
import type { QuizEngine } from '../../src/services/quiz/QuizEngine.js';

function fakeEngine(cards: unknown[]): QuizEngine {
  return { allCards: () => cards } as unknown as QuizEngine;
}

const CARDS = [
  {
    id: 'c1',
    indonesian: 'makan',
    english: 'eat',
    sentences: [
      { id: 's1', text: 'Saya makan nasi.', blank: 'makan', en: 'I eat rice.' },
      { id: 's2', text: 'Dia makan apel.', blank: 'makan', en: 'He eats an apple.' },
    ],
  },
  {
    id: 'c2',
    indonesian: 'minum',
    english: 'drink',
    sentences: [
      { id: 's3', text: 'Saya minum air.', blank: 'minum', en: 'I drink water.' },
      { id: 's4', text: 'no-translation', blank: 'minum', en: '' }, // dropped: empty en
    ],
  },
];

test('pool flattens sentences, drops ones missing text/en, sets word from card', () => {
  const svc = new DailySentenceService(fakeEngine(CARDS));
  assert.equal(svc.size, 3); // s1, s2, s3 (s4 dropped)
  const r = svc.pick([]);
  assert.ok(r);
  assert.ok(['s1', 's2', 's3'].includes(r!.entry.sentenceId));
  if (r!.entry.sentenceId === 's3') assert.equal(r!.entry.word, 'minum');
});

test('pick excludes seen IDs', () => {
  // rng forced to 0 → always first candidate
  const svc = new DailySentenceService(fakeEngine(CARDS), () => 0);
  const r = svc.pick(['s1']);
  assert.ok(r);
  assert.notEqual(r!.entry.sentenceId, 's1');
  assert.deepEqual(r!.nextSeenIds, ['s1', r!.entry.sentenceId]);
});

test('pick resets rotation when every sentence is seen', () => {
  const svc = new DailySentenceService(fakeEngine(CARDS), () => 0);
  const r = svc.pick(['s1', 's2', 's3']);
  assert.ok(r); // not null — reset and picked from full pool
  // after reset, base is empty, so nextSeenIds holds only the new pick
  assert.equal(r!.nextSeenIds.length, 1);
});

test('seen list is capped at poolSize - 1', () => {
  const svc = new DailySentenceService(fakeEngine(CARDS), () => 0);
  // pool size 3 → cap 2. Seed with one unseen so we do not trigger reset.
  const r = svc.pick(['s2', 's3']);
  assert.ok(r);
  assert.equal(r!.entry.sentenceId, 's1');
  assert.deepEqual(r!.nextSeenIds, ['s3', 's1']); // ['s2','s3','s1'] sliced to last 2
});

test('pick returns null on empty pool', () => {
  const svc = new DailySentenceService(fakeEngine([]));
  assert.equal(svc.pick([]), null);
});
