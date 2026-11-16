import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { QuizEngine } from '../../../src/services/quiz/QuizEngine.js';
import { buildExercise } from '../../../src/services/session/ExerciseFactory.js';
import {
  renderWidgetQuestion, renderWidgetFeedback, renderWidgetFinish, MAX_STATE_BYTES,
} from '../../../src/services/session/WidgetRenderer.js';
import type { Exercise } from '../../../src/services/session/types.js';

const view = {
  sessionId: 'a'.repeat(24), cursor: 4, index: 2, total: 10, xpTotal: 120,
  correctCount: 2, builderPicked: [] as number[],
};
const fullFeedback = {
  word: 'makan', wordEn: 'to eat', sentence: 'Saya mau makan', sentenceEn: 'I want to eat', note: 'n',
};
const choiceEx: Exercise = {
  cardId: 'c1', kind: 'choice', prompt: '🔊 What does this mean?',
  options: ['to eat', 'to drink', 'to go', 'to sit'], correctIndex: 0,
  answer: 'to eat', feedback: fullFeedback,
};
const builderEx: Exercise = {
  cardId: 'c1', kind: 'builder', prompt: '🧱 Build the sentence:\n"I want to eat"',
  tiles: ['makan', 'Saya', 'mau'], answer: 'Saya mau makan', feedback: fullFeedback,
};
const typeEx: Exercise = {
  cardId: 'c1', kind: 'type', prompt: '✍️ Type it in Indonesian: "to eat"', answer: 'makan', feedback: fullFeedback,
};
const bytes = (s: string) => Buffer.byteLength(s);

test('choice: options, correct index, answer, feedback and header', () => {
  assert.deepEqual(JSON.parse(renderWidgetQuestion(view, choiceEx)), {
    k: 'choice', q: 4, i: 2, n: 10, xp: 120, p: '🔊 What does this mean?',
    o: ['to eat', 'to drink', 'to go', 'to sit'], c: 0, a: 'to eat',
    fb: { w: 'makan', e: 'to eat', s: 'Saya mau makan', se: 'I want to eat', nt: 'n' },
  });
});

test('builder: tiles and the answer sentence, no options', () => {
  const s = JSON.parse(renderWidgetQuestion(view, builderEx));
  assert.deepEqual(s.t, ['makan', 'Saya', 'mau']);
  assert.equal(s.a, 'Saya mau makan');
  assert.equal(s.o, undefined);
});

test('type: prompt only — the answer never travels to the widget', () => {
  const s = JSON.parse(renderWidgetQuestion(view, typeEx));
  assert.deepEqual(s, { k: 'type', q: 4, i: 2, n: 10, xp: 120, p: typeEx.prompt });
});

test('flash: label, corrected spelling, and default', () => {
  const fl = (flash: { correct: boolean; xp: number; corrected?: string; label?: string }) =>
    JSON.parse(renderWidgetQuestion({ ...view, flash }, typeEx)).fl;
  assert.deepEqual(fl({ correct: true, xp: 10, label: 'makan — to eat' }), { x: 10, l: 'makan — to eat' });
  assert.deepEqual(fl({ correct: true, xp: 10, corrected: 'makan' }), { x: 10, l: 'Almost — correct spelling: makan' });
  assert.deepEqual(fl({ correct: true, xp: 10 }), { x: 10, l: 'Benar!' });
  assert.equal(fl({ correct: false, xp: 0 }), undefined);
});

test('feedback: answer and feedback block', () => {
  assert.deepEqual(JSON.parse(renderWidgetFeedback(view, choiceEx)), {
    k: 'feedback', q: 4, i: 2, n: 10, xp: 120, a: 'to eat',
    fb: { w: 'makan', e: 'to eat', s: 'Saya mau makan', se: 'I want to eat', nt: 'n' },
  });
});

test('finish: caps missed words at 8 and counts the rest; expired flag', () => {
  const f = {
    correctCount: 7, total: 10, xpEarned: 95, newWords: ['pasar'],
    missedWords: Array.from({ length: 11 }, (_, i) => `kata${i} — word${i}`), dueTomorrow: 3,
  };
  const s = JSON.parse(renderWidgetFinish(f));
  assert.equal(s.k, 'finish');
  assert.deepEqual([s.sc, s.tot, s.xe, s.due], [7, 10, 95, 3]);
  assert.equal(s.mw.length, 8);
  assert.equal(s.more, 3);
  assert.equal(s.ex, undefined);
  assert.equal(JSON.parse(renderWidgetFinish(f, true)).ex, 1);
});

test('budget: drops the note first, then the sentence, never the word pair', () => {
  const long = 'x'.repeat(700);
  const noteOnly = JSON.parse(
    renderWidgetFeedback(view, { ...choiceEx, feedback: { ...fullFeedback, note: long + long } }),
  );
  assert.equal(noteOnly.fb.nt, undefined);
  assert.equal(noteOnly.fb.s, 'Saya mau makan');
  const both = renderWidgetFeedback(view, {
    ...choiceEx, feedback: { ...fullFeedback, note: long + long, sentence: long, sentenceEn: long },
  });
  assert.ok(bytes(both) <= MAX_STATE_BYTES);
  assert.deepEqual(JSON.parse(both).fb, { w: 'makan', e: 'to eat' });
});

test('budget: finish screen sheds list entries until it fits', () => {
  const out = renderWidgetFinish({
    correctCount: 1, total: 20, xpEarned: 10, dueTomorrow: 0,
    newWords: Array.from({ length: 20 }, (_, i) => 'kata-baru-yang-panjang-' + i),
    missedWords: Array.from({ length: 8 }, (_, i) => 'x'.repeat(100) + i),
  });
  assert.ok(bytes(out) <= MAX_STATE_BYTES);
  assert.ok(JSON.parse(out).more > 0);
});

test('budget: every card in the real deck fits in every kind it supports', async () => {
  const cards = (await QuizEngine.load(path.resolve('content/quiz'))).allCards();
  const v = { ...view, cursor: 29, index: 19, total: 20, xpTotal: 123456, flash: { correct: true, xp: 20, label: 'x'.repeat(120) } };
  let checked = 0;
  for (const card of cards) {
    for (const kind of ['intro', 'choice', 'cloze', 'builder', 'type', 'speak'] as const) {
      let ex: Exercise;
      try {
        ex = buildExercise(card, cards, kind, {});
      } catch {
        continue; // card has no sentence for this kind
      }
      for (const s of [renderWidgetQuestion(v, ex), renderWidgetFeedback(v, ex)]) {
        assert.ok(bytes(s) <= MAX_STATE_BYTES, `${card.id} ${kind}: ${bytes(s)} bytes`);
        checked++;
      }
    }
  }
  assert.ok(checked > 10000);
});

test('budget: an oversized prompt is cut to plain text instead of throwing', () => {
  const out = renderWidgetQuestion(view, { ...typeEx, prompt: '<b>' + 'y'.repeat(2000) + '</b>' });
  assert.ok(bytes(out) <= MAX_STATE_BYTES);
  assert.ok(!JSON.parse(out).p.includes('<'));
});
