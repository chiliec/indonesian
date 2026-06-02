import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build, eligibleTypes } from '../../src/services/quiz/QuestionFactory.js';
import type { QuizCard } from '../../src/services/quiz/types.js';

const pool: QuizCard[] = [
  { id: 'c1', indonesian: 'pasar', english: 'market', audio: 'a.ogg' },
  { id: 'c2', indonesian: 'rumah', english: 'house', audio: 'b.ogg' },
  { id: 'c3', indonesian: 'air', english: 'water', audio: 'c.ogg' },
  { id: 'c4', indonesian: 'teman', english: 'friend', audio: 'd.ogg' },
  { id: 'c5', indonesian: 'makan', english: 'eat', audio: 'e.ogg' },
];
const noAudio: QuizCard = { id: 'n1', indonesian: 'buku', english: 'book' };

test('eligibleTypes: audio card supports all three, audioless drops listen', () => {
  assert.deepEqual(eligibleTypes(pool[0]!), ['listen', 'produce', 'text']);
  assert.deepEqual(eligibleTypes(noAudio), ['text', 'produce']);
});

test('listen: audio in poll, English options, generic prompt (ID hidden)', () => {
  const q = build(pool[0]!, pool, { type: 'listen', rng: () => 0 });
  assert.equal(q.type, 'listen');
  assert.equal(q.audioFile, 'a.ogg');
  assert.equal(q.options.length, 4);
  assert.equal(new Set(q.options).size, 4);
  assert.equal(q.options[q.correctIndex], 'market');
  assert.doesNotMatch(q.promptText, /pasar/); // Indonesian word stays hidden
  assert.equal(q.explanation, 'pasar = market');
});

test('text: Indonesian shown, English options, no audio', () => {
  const q = build(pool[0]!, pool, { type: 'text', rng: () => 0.5 });
  assert.equal(q.type, 'text');
  assert.equal(q.audioFile, undefined);
  assert.equal(q.options[q.correctIndex], 'market');
  assert.match(q.promptText, /pasar/);
});

test('produce: English shown, Indonesian options, no audio', () => {
  const q = build(pool[0]!, pool, { type: 'produce', rng: () => 0.5 });
  assert.equal(q.type, 'produce');
  assert.equal(q.audioFile, undefined);
  assert.equal(q.options[q.correctIndex], 'pasar');
  assert.match(q.promptText, /market/);
});

test('auto-select: audioless card is always text', () => {
  // rng=0 would trigger the produce roll, but no audio forces text.
  const q = build(noAudio, [noAudio, ...pool], { isMastered: true, rng: () => 0 });
  assert.equal(q.type, 'text');
});

test('auto-select: unmastered audio card is listen even when the roll would pass', () => {
  const q = build(pool[0]!, pool, { isMastered: false, rng: () => 0 });
  assert.equal(q.type, 'listen');
});

test('auto-select: mastered audio card becomes produce when the roll passes', () => {
  const q = build(pool[0]!, pool, { isMastered: true, rng: () => 0 }); // 0 < 1/5
  assert.equal(q.type, 'produce');
});

test('auto-select: mastered audio card stays listen when the roll fails', () => {
  const q = build(pool[0]!, pool, { isMastered: true, rng: () => 0.9 }); // 0.9 >= 1/5
  assert.equal(q.type, 'listen');
});

test('explicit type wins only when eligible for the card', () => {
  // listen is not eligible for an audioless card -> falls back to auto (text).
  const q = build(noAudio, [noAudio, ...pool], { type: 'listen', rng: () => 0 });
  assert.equal(q.type, 'text');
});

test('distractors come from the pool and never duplicate the answer', () => {
  const q = build(pool[0]!, pool, { type: 'text', rng: () => 0.3 });
  const others = q.options.filter((_, i) => i !== q.correctIndex);
  for (const o of others) {
    assert.notEqual(o, 'market');
    assert.ok(pool.some((c) => c.english === o));
  }
});

test('clamps poll fields to Telegram limits (option 100, question 300, explanation 200)', () => {
  const longEn = 'e'.repeat(250);
  const longId = 'i'.repeat(400);
  const longCard: QuizCard = { id: 'long', indonesian: longId, english: longEn };
  const longPool: QuizCard[] = [
    longCard,
    { id: 'd1', indonesian: 'x'.repeat(150), english: 'y'.repeat(150) },
    { id: 'd2', indonesian: 'p'.repeat(150), english: 'q'.repeat(150) },
    { id: 'd3', indonesian: 'm'.repeat(150), english: 'n'.repeat(150) },
  ];
  // text mode embeds the long Indonesian term in the prompt; options are English.
  const q = build(longCard, longPool, { type: 'text', rng: () => 0 });
  assert.ok(q.promptText.length <= 300, `promptText ${q.promptText.length} > 300`);
  for (const o of q.options) assert.ok(o.length <= 100, `option ${o.length} > 100`);
  assert.ok(q.explanation.length <= 200, `explanation ${q.explanation.length} > 200`);
  assert.equal(new Set(q.options).size, q.options.length);
});
