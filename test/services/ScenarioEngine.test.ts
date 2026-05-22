import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ScenarioEngine } from '../../src/services/scenarios/ScenarioEngine.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', '..', 'scenarios');

test('loads ojek-to-canggu scenario from yaml', async () => {
  const engine = await ScenarioEngine.load(fixtures);
  const s = engine.get('ojek-to-canggu');
  assert.ok(s, 'scenario must exist');
  assert.equal(s.id, 'ojek-to-canggu');
  assert.ok(s.title.en.length > 0);
  assert.ok(s.title.ru.length > 0);
  assert.equal(s.difficulty, 'A1');
  assert.ok(s.systemPrompt.length > 50);
});

test('list() returns all scenarios in deterministic order', async () => {
  const engine = await ScenarioEngine.load(fixtures);
  const list = engine.list();
  assert.ok(list.length >= 8);
  assert.ok(list.some((s) => s.id === 'ojek-to-canggu'));
});

test('get() returns undefined for unknown id', async () => {
  const engine = await ScenarioEngine.load(fixtures);
  assert.equal(engine.get('does-not-exist'), undefined);
});
