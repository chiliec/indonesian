import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GeneratedSchema, applyEnrichment, buildEnrichmentPrompt } from '../../scripts/enrich/lib.js';
import type { QuizCard } from '../../src/services/quiz/types.js';

const card: QuizCard = { id: 'm1-0009', indonesian: 'makan', english: 'to eat' };

const gen = {
  note: { en: 'Also "to have a meal".' },
  sentences: [
    { text: 'Saya mau makan nasi goreng', blank: 'makan', en: 'I want to eat fried rice' },
    { text: 'Kami makan di rumah', blank: 'makan', en: 'We eat at home' },
  ],
};

test('GeneratedSchema accepts valid output and rejects bad blanks / long sentences', () => {
  assert.ok(GeneratedSchema.parse(gen));
  assert.throws(() => GeneratedSchema.parse({
    ...gen,
    sentences: [{ text: 'Saya mau minum', blank: 'makan', en: 'x' }, { text: 'Kami makan di rumah', blank: 'makan', en: 'y' }],
  }));
  assert.throws(() => GeneratedSchema.parse({
    ...gen,
    sentences: [{ text: 'satu dua tiga empat lima enam tujuh delapan sembilan', blank: 'satu', en: 'x' }, { text: 'Kami makan di rumah', blank: 'makan', en: 'y' }],
  }));
});

test('applyEnrichment attaches note + sentences with stable ids and audio names', () => {
  const enriched = applyEnrichment(card, gen, ['9f3c2a1b07de.ogg', 'aa11bb22cc33.ogg']);
  assert.equal(enriched.note!.en, gen.note.en);
  assert.equal(enriched.sentences!.length, 2);
  assert.equal(enriched.sentences![0]!.id, 'm1-0009-s1');
  assert.equal(enriched.sentences![0]!.audio, '9f3c2a1b07de.ogg');
  assert.equal(enriched.sentences![1]!.id, 'm1-0009-s2');
});

test('applyEnrichment omits audio for null entries (dry-run)', () => {
  const enriched = applyEnrichment(card, gen, [null, null]);
  assert.equal(enriched.sentences![0]!.audio, undefined);
});

test('buildEnrichmentPrompt mentions the word and the JSON contract', () => {
  const p = buildEnrichmentPrompt(card);
  assert.ok(p.includes('makan'));
  assert.ok(p.includes('to eat'));
  assert.ok(p.toLowerCase().includes('json'));
});
