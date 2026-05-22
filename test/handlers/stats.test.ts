import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAdmin } from '../../src/handlers/stats.js';

test('isAdmin true for id in list', () => {
  assert.equal(isAdmin(42, '42,99'), true);
  assert.equal(isAdmin(99, '42,99'), true);
});

test('isAdmin false for non-listed', () => {
  assert.equal(isAdmin(1, '42,99'), false);
});

test('isAdmin false when env empty', () => {
  assert.equal(isAdmin(42, ''), false);
});
