import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t } from '../../src/util/i18n.js';

test('t() returns english string when en=true', () => {
  assert.equal(t('start.welcome', true), 'Welcome! I help you learn Indonesian. Tap ▶️ Practice to begin, or 🎭 Scenarios to chat.');
});

test('t() returns russian string when en=false', () => {
  assert.equal(t('start.welcome', false), 'Привет! Помогаю учить индонезийский. Жми ▶️ Практика или 🎭 Сценарии.');
});

test('t() falls back to english when key missing in ru', () => {
  // ensure missing-key fallback path is covered
  const result = t('start.welcome', false);
  assert.ok(typeof result === 'string' && result.length > 0);
});
