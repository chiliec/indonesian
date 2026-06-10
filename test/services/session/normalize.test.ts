import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAnswer, editDistance, matchAnswer } from '../../../src/services/session/normalize.js';

test('normalizeAnswer lowercases, strips punctuation/diacritics, collapses spaces', () => {
  assert.equal(normalizeAnswer('  Apa  Kabar?! '), 'apa kabar');
  assert.equal(normalizeAnswer('péta'), 'peta');
  assert.equal(normalizeAnswer('baik-baik saja'), 'baikbaik saja');
});

test('editDistance', () => {
  assert.equal(editDistance('makan', 'makan'), 0);
  assert.equal(editDistance('makan', 'makam'), 1);
  assert.equal(editDistance('makan', 'mkan'), 1);
  assert.equal(editDistance('makan', 'minum'), 4);
});

test('matchAnswer: exact / close (distance 1) / wrong', () => {
  assert.equal(matchAnswer('Makan!', 'makan'), 'exact');
  assert.equal(matchAnswer('makam', 'makan'), 'close');
  assert.equal(matchAnswer('minum', 'makan'), 'wrong');
  assert.equal(matchAnswer('', 'makan'), 'wrong');
});

test('matchAnswer: short targets require exact match', () => {
  assert.equal(matchAnswer('ta', 'ya'), 'wrong');
  assert.equal(matchAnswer('ya', 'ya'), 'exact');
  assert.equal(matchAnswer('mkan', 'makan'), 'close'); // 5-char target still tolerant
});

test('matchAnswer: hyphenated compounds normalize consistently', () => {
  assert.equal(matchAnswer('baik-baik saja', 'baik-baik saja'), 'exact');
  assert.equal(matchAnswer('baikbaik saja', 'baik-baik saja'), 'exact'); // hyphen stripped both sides
});
