import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainKeyboard, matchAction } from '../../src/handlers/keyboard.js';

test('mainKeyboard builds the 2x2 layout', () => {
  assert.deepEqual(mainKeyboard().build(), [
    [{ text: '▶️ Practice' }, { text: '🎭 Scenarios' }],
    [{ text: '📊 Progress' }, { text: '⚙️ Settings' }],
  ]);
});

test('mainKeyboard is resized + persistent', () => {
  const kb = mainKeyboard();
  assert.equal(kb.resize_keyboard, true);
  assert.equal(kb.is_persistent, true);
});

test('matchAction maps EN labels', () => {
  assert.equal(matchAction('▶️ Practice'), 'practice');
  assert.equal(matchAction('🎭 Scenarios'), 'scenarios');
  assert.equal(matchAction('📊 Progress'), 'progress');
  assert.equal(matchAction('⚙️ Settings'), 'settings');
});

test('matchAction returns null for non-labels', () => {
  assert.equal(matchAction('Selamat pagi'), null);
  assert.equal(matchAction('/start'), null);
  assert.equal(matchAction(''), null);
});
