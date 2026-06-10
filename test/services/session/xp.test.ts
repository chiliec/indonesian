import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xpFor, COMPLETION_BONUS } from '../../../src/services/session/xp.js';

test('xp scales with exercise difficulty', () => {
  assert.equal(xpFor('choice'), 10);
  assert.equal(xpFor('cloze'), 12);
  assert.equal(xpFor('builder'), 15);
  assert.equal(xpFor('type'), 17);
  assert.equal(xpFor('speak'), 20);
});

test('completion bonus is 25', () => {
  assert.equal(COMPLETION_BONUS, 25);
});
