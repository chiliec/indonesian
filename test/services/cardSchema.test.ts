import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ModuleSchema } from '../../src/services/quiz/cardSchema.js';

const base = {
  id: 'module-1',
  title: { en: 'M1' },
  cards: [{ id: 'm1-0001', indonesian: 'makan', english: 'to eat' }],
};

test('accepts a plain module without enrichment', () => {
  assert.equal(ModuleSchema.parse(base).id, 'module-1');
});

test('accepts enriched cards', () => {
  const enriched = {
    ...base,
    cards: [{
      id: 'm1-0001', indonesian: 'makan', english: 'to eat', audio: 'abc.ogg',
      note: { en: 'Also "to have a meal".' },
      sentences: [{ id: 'm1-0001-s1', text: 'Saya mau makan nasi goreng', blank: 'makan', en: 'I want to eat fried rice', audio: 'def.ogg' }],
    }],
  };
  const parsed = ModuleSchema.parse(enriched);
  assert.equal(parsed.cards[0]!.sentences![0]!.blank, 'makan');
});

test('rejects a sentence whose blank is missing from the text', () => {
  const bad = {
    ...base,
    cards: [{
      id: 'm1-0001', indonesian: 'makan', english: 'to eat',
      sentences: [{ id: 's1', text: 'Saya mau minum', blank: 'makan', en: 'x' }],
    }],
  };
  assert.throws(() => ModuleSchema.parse(bad), /blank/);
});

test('rejects a module with no cards', () => {
  assert.throws(() => ModuleSchema.parse({ ...base, cards: [] }));
});

test('rejects a sentence whose blank appears only inside another word', () => {
  const bad = {
    ...base,
    cards: [{
      id: 'm1-0001', indonesian: 'makan', english: 'to eat',
      sentences: [{ id: 's1', text: 'Saya memakan nasi', blank: 'makan', en: 'x' }],
    }],
  };
  assert.throws(() => ModuleSchema.parse(bad), /blank/);
});

test('accepts a sentence where the blank is followed by punctuation', () => {
  const ok = {
    ...base,
    cards: [{
      id: 'm1-0001', indonesian: 'makan', english: 'to eat',
      sentences: [{ id: 's1', text: 'Dia makan.', blank: 'makan', en: 'He eats.' }],
    }],
  };
  assert.ok(ModuleSchema.parse(ok));
});
