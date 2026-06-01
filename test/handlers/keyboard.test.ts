import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mainKeyboard, matchAction } from '../../src/handlers/keyboard.js';

test('mainKeyboard (en) builds the 2x2 layout', () => {
  assert.deepEqual(mainKeyboard(true).build(), [
    [{ text: '▶️ Practice' }, { text: '🎭 Scenarios' }],
    [{ text: '📊 Progress' }, { text: '⚙️ Settings' }],
  ]);
});

test('mainKeyboard (ru) builds the 2x2 layout', () => {
  assert.deepEqual(mainKeyboard(false).build(), [
    [{ text: '▶️ Практика' }, { text: '🎭 Сценарии' }],
    [{ text: '📊 Прогресс' }, { text: '⚙️ Настройки' }],
  ]);
});

test('mainKeyboard is resized + persistent', () => {
  const kb = mainKeyboard(true);
  assert.equal(kb.resize_keyboard, true);
  assert.equal(kb.is_persistent, true);
});

test('matchAction maps EN labels', () => {
  assert.equal(matchAction('▶️ Practice'), 'practice');
  assert.equal(matchAction('🎭 Scenarios'), 'scenarios');
  assert.equal(matchAction('📊 Progress'), 'progress');
  assert.equal(matchAction('⚙️ Settings'), 'settings');
});

test('matchAction maps RU labels', () => {
  assert.equal(matchAction('▶️ Практика'), 'practice');
  assert.equal(matchAction('🎭 Сценарии'), 'scenarios');
  assert.equal(matchAction('📊 Прогресс'), 'progress');
  assert.equal(matchAction('⚙️ Настройки'), 'settings');
});

test('matchAction returns null for non-labels', () => {
  assert.equal(matchAction('Selamat pagi'), null);
  assert.equal(matchAction('/start'), null);
  assert.equal(matchAction(''), null);
});
