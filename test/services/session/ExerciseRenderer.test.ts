// test/services/session/ExerciseRenderer.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  renderQuestion, renderFeedback, renderFinish, recapOf,
} from '../../../src/services/session/ExerciseRenderer.js';
import type { Exercise } from '../../../src/services/session/types.js';

const SID = 'a'.repeat(24);
const view = {
  sessionId: SID, cursor: 2, index: 2, total: 10, xpTotal: 120,
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

test('renderFinish: score, xp, new words, review list, due count, again button', () => {
  const v = renderFinish({
    correctCount: 9, total: 12, xpEarned: 120,
    missedWords: ['makan — to eat'], newWords: ['minum', 'tidur'], dueTomorrow: 12,
  });
  assert.ok(v.text.includes('9/12'));
  assert.ok(v.text.includes('+120 XP'));
  assert.ok(v.text.includes('🆕 New: minum, tidur'));
  assert.ok(v.text.includes('🔁 To review:\n• makan — to eat'));
  assert.ok(v.text.includes('📅 12 words due tomorrow'));
  assert.equal(v.buttons[0]![0]!.data, 'p:again');
  assert.equal(v.finished, true);
});

test('renderFinish: optional lines are omitted; singular due count', () => {
  const bare = renderFinish({ correctCount: 5, total: 5, xpEarned: 75, missedWords: [], newWords: [], dueTomorrow: 0 });
  assert.equal(bare.text, '🏁 Session done!\n✅ 5/5 · ⭐ +75 XP');
  const one = renderFinish({ correctCount: 5, total: 5, xpEarned: 75, missedWords: [], newWords: [], dueTomorrow: 1 });
  assert.ok(one.text.includes('📅 1 word due tomorrow'));
});

const withWord: Exercise = { ...choiceEx, feedback: { ...choiceEx.feedback, word: 'makan', wordEn: 'to eat' } };

test('renderQuestion intro: Got it button on the next callback, audio carried', () => {
  const intro: Exercise = {
    cardId: 'c1', kind: 'intro', prompt: '🆕 <b>New word</b>\n\n<b>makan</b> — to eat',
    answer: 'makan', audioFile: 'a.ogg', feedback: {},
  };
  const v = renderQuestion(view, intro);
  assert.ok(v.text.includes('3/10'));
  assert.ok(v.text.includes('New word'));
  assert.deepEqual(v.buttons, [[{ text: 'Got it ▶️', data: `s:${SID}:n` }]]);
  assert.equal(v.audioFile, 'a.ogg');
});

test('recapOf: word pair by default, full sentence for cloze/builder, nothing for legacy', () => {
  assert.equal(recapOf(withWord), 'makan — to eat');
  assert.equal(recapOf({ ...withWord, kind: 'cloze' }), 'Saya mau makan — I want to eat');
  assert.equal(recapOf({ ...withWord, kind: 'builder' }), 'Saya mau makan — I want to eat');
  assert.equal(recapOf(choiceEx), undefined);
});

test('renderQuestion: flash names the word when a label is given', () => {
  const v = renderQuestion({ ...view, flash: { correct: true, xp: 10, label: 'makan — to <eat>' } }, choiceEx);
  assert.ok(v.text.includes('✅ makan — to &lt;eat&gt; +10 XP'));
  assert.ok(!v.text.includes('Benar'));
});

test('renderQuestion: corrected-spelling flash wins over the label', () => {
  const v = renderQuestion(
    { ...view, flash: { correct: true, xp: 17, corrected: 'makan', label: 'makan — to eat' } }, choiceEx);
  assert.ok(v.text.includes('✅ Almost — correct spelling: <i>makan</i> +17 XP'));
});

test('renderFeedback: shows the word pair under the correct answer', () => {
  const v = renderFeedback(view, withWord);
  assert.ok(v.text.includes('Correct answer: <b>to eat</b>\nmakan — to eat'));
  assert.ok(!renderFeedback(view, choiceEx).text.includes('makan — to eat'));
});
