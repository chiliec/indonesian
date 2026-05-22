import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLangCallback } from '../../src/handlers/lang.js';

test('parseLangCallback extracts en', () => {
  assert.equal(parseLangCallback('lang:en'), 'en');
});

test('parseLangCallback extracts ru', () => {
  assert.equal(parseLangCallback('lang:ru'), 'ru');
});

test('parseLangCallback returns null for garbage', () => {
  assert.equal(parseLangCallback('garbage'), null);
});
