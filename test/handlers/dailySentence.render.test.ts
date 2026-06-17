import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderDailySentence } from '../../src/handlers/dailySentence.js';
import type { DailySentenceEntry } from '../../src/services/DailySentenceService.js';

const ENTRY: DailySentenceEntry = {
  sentenceId: 's1',
  cardId: 'c1',
  text: 'Saya <suka> makan.',
  en: 'I like to eat.',
  word: 'makan',
};

test('renderDailySentence (en) bolds sentence, escapes HTML, adds Another button', () => {
  const { text, keyboard } = renderDailySentence(ENTRY, true);
  assert.match(text, /🌅 Sentence of the day/);
  assert.match(text, /<b>Saya &lt;suka&gt; makan\.<\/b>/);
  assert.match(text, /I like to eat\./);
  const row = keyboard.inline_keyboard[0]!;
  assert.equal(row[0]!.text, '🔄 Another sentence');
  assert.equal((row[0] as { callback_data: string }).callback_data, 'ds:another');
});

test('renderDailySentence (ru) localizes chrome, keeps English gloss', () => {
  const { text } = renderDailySentence(ENTRY, false);
  assert.match(text, /🌅 Фраза дня/);
  assert.match(text, /I like to eat\./); // ru users still see the English gloss (known limitation)
});
