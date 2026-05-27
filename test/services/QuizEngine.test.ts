import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { QuizEngine } from '../../src/services/quiz/QuizEngine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'fixtures', 'quiz');

test('loads module-1 from yaml', async () => {
  const engine = await QuizEngine.load(fixtures);
  const m = engine.get('module-1');
  assert.ok(m);
  assert.equal(m.id, 'module-1');
  assert.equal(m.cards.length, 5);
  assert.equal(m.cards[0]!.indonesian, 'pasar');
});

test('list() returns modules sorted by id', async () => {
  const engine = await QuizEngine.load(fixtures);
  const list = engine.list();
  assert.deepEqual(list.map((m) => m.id), ['module-1', 'module-2']);
});

test('get() returns undefined for unknown id', async () => {
  const engine = await QuizEngine.load(fixtures);
  assert.equal(engine.get('nope'), undefined);
});
