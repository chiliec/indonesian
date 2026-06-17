// test/services/session/ExerciseRenderer.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderQuestion, renderFeedback, renderFinish,
} from '../../../src/services/session/ExerciseRenderer.js';
import type { Exercise } from '../../../src/services/session/types.js';

const SID = 'a'.repeat(24);
const view = {
  sessionId: SID, index: 2, total: 10, xpTotal: 120,
  correctCount: 2, builderPicked: [] as number[],
};

const choiceEx: Exercise = {
  cardId: 'c1', kind: 'choice', prompt: '🔊 What does this mean?',
  options: ['to eat', 'to drink', 'to go', 'to sit'], correctIndex: 0,
  answer: 'to eat', audioFile: 'a.ogg',
  feedback: { sentence: 'Saya mau makan', sentenceEn: 'I want to eat', note: 'n' },
};

test('renderQuestion: header bar, prompt, option buttons with callback protocol', () => {
  const v = renderQuestion(view, choiceEx);
  assert.ok(v.text.includes('▰▰▱▱▱▱▱▱▱▱'));
  assert.ok(v.text.includes('3/10'));
  assert.ok(v.text.includes('⭐ 120 XP'));
  assert.ok(v.text.includes('What does this mean?'));
  assert.equal(v.buttons.flat().length, 4);
  assert.equal(v.buttons[0]![0]!.data, `s:${SID}:a:0`);
  assert.equal(v.audioFile, 'a.ogg');
  assert.equal(v.finished, false);
});

test('renderQuestion: flash line from previous answer', () => {
  const v = renderQuestion({ ...view, flash: { correct: true, xp: 12 } }, choiceEx);
  assert.ok(v.text.includes('✅ Benar! +12 XP'));
});

test('renderQuestion builder: unpicked tiles + undo, picked words shown', () => {
  const ex: Exercise = {
    cardId: 'c1', kind: 'builder', prompt: '🧱 Build the sentence:\n"I want to eat"',
    tiles: ['mau', 'Saya', 'makan'], answer: 'Saya mau makan', feedback: {},
  };
  const v = renderQuestion({ ...view, builderPicked: [1] }, ex);
  assert.ok(v.text.includes('Saya'));            // picked word echoed in text
  const labels = v.buttons.flat().map((b) => b.text);
  assert.ok(!labels.includes('Saya'));            // picked tile removed from keyboard
  assert.ok(labels.includes('mau') && labels.includes('makan'));
  assert.ok(v.buttons.flat().some((b) => b.data === `s:${SID}:u`));
});

test('renderQuestion type/speak: no buttons', () => {
  const ex: Exercise = {
    cardId: 'c1', kind: 'type', prompt: '✍️ Type it in Indonesian: "to eat"',
    answer: 'makan', feedback: {},
  };
  const v = renderQuestion(view, ex);
  assert.equal(v.buttons.length, 0);
});

test('renderFeedback: correct answer, sentence, note, next button', () => {
  const v = renderFeedback(view, choiceEx);
  assert.ok(v.text.includes('to eat'));
  assert.ok(v.text.includes('Saya mau makan'));
  assert.ok(v.text.includes('I want to eat'));
  assert.equal(v.buttons[0]![0]!.data, `s:${SID}:n`);
});

test('renderFinish: score, xp, review list, again button', () => {
  const v = renderFinish(
    { correctCount: 9, total: 12, xpEarned: 120, missedWords: ['makan — to eat'] },
  );
  assert.ok(v.text.includes('9/12'));
  assert.ok(v.text.includes('+120 XP'));
  assert.ok(v.text.includes('makan — to eat'));
  assert.equal(v.buttons[0]![0]!.data, 'p:again');
  assert.equal(v.finished, true);
});
