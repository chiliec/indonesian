import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractCards } from '../../scripts/anki/extractCards.js';
import type { RawNote } from '../../scripts/anki/parseApkg.js';

const notes: RawNote[] = [
  { id: 1, fields: ['pasar', 'market', '[sound:greeting1.mp3]'] },
  { id: 2, fields: ['rumah', 'house', ''] },
  { id: 3, fields: ['', 'nofront', ''] }, // skipped: missing indonesian
];

test('extractCards maps fields and audio refs with defaults', () => {
  const { cards, skipped } = extractCards('module-1', notes, {});
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    id: 'module-1-0001',
    indonesian: 'pasar',
    english: 'market',
    audio: 'greeting1.mp3',
  });
  // no audio ref -> no audio field
  assert.equal(cards[1]!.audio, undefined);
  assert.equal(cards[1]!.indonesian, 'rumah');
  assert.equal(skipped, 1);
});

test('extractCards honours custom field indices', () => {
  const swapped: RawNote[] = [{ id: 5, fields: ['market', 'pasar', '[sound:a.mp3]'] }];
  const { cards } = extractCards('module-2', swapped, { indonesianIdx: 1, englishIdx: 0 });
  assert.equal(cards[0]!.indonesian, 'pasar');
  assert.equal(cards[0]!.english, 'market');
  assert.equal(cards[0]!.audio, 'a.mp3');
});
