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
