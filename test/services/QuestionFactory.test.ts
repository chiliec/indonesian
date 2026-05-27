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

test('eligibleTypes excludes audio types when card has no audio', () => {
  assert.deepEqual(eligibleTypes({ id: 'x', indonesian: 'a', english: 'b' }), ['id-en', 'en-id']);
  assert.equal(eligibleTypes(pool[0]!).length, 4);
});

test('audio-en builds 4 unique options with correct english answer + audio', () => {
  const q = build(pool[0]!, pool, { type: 'audio-en', rng: () => 0 });
  assert.equal(q.type, 'audio-en');
  assert.equal(q.audioFile, 'a.ogg');
  assert.equal(q.options.length, 4);
  assert.equal(new Set(q.options).size, 4);
  assert.equal(q.options[q.correctIndex], 'market');
  assert.ok(q.options.includes('market'));
  assert.equal(q.explanation, 'pasar = market');
});

test('id-en builds english options, no audio field', () => {
  const q = build(pool[0]!, pool, { type: 'id-en', rng: () => 0.5 });
  assert.equal(q.audioFile, undefined);
  assert.equal(q.options[q.correctIndex], 'market');
  assert.match(q.promptText, /pasar/);
});

test('en-id builds indonesian options', () => {
  const q = build(pool[0]!, pool, { type: 'en-id', rng: () => 0.5 });
  assert.equal(q.options[q.correctIndex], 'pasar');
  assert.match(q.promptText, /market/);
});

test('distractors come from the pool and never duplicate the answer', () => {
  const q = build(pool[0]!, pool, { type: 'id-en', rng: () => 0.3 });
  const others = q.options.filter((_, i) => i !== q.correctIndex);
  for (const o of others) {
    assert.notEqual(o, 'market');
    assert.ok(pool.some((c) => c.english === o));
  }
});
