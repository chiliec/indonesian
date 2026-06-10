import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { QuizEngine } from '../../src/services/quiz/QuizEngine.js';
import { QuizService, MIXED_MODULE_ID } from '../../src/services/QuizService.js';
import { QuizProgressRepo } from '../../src/db/quizProgress.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, '..', 'fixtures', 'quiz');

let svc: QuizService;

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  const engine = await QuizEngine.load(fixtures);
  svc = new QuizService({ engine, progress: new QuizProgressRepo() });
});

test('moduleList reports mastery percentages with Mixed first', async () => {
  const list = await svc.moduleList(1);
  // 2 fixture modules + the synthetic Mixed entry, which sorts first.
  assert.equal(list.length, 3);
  assert.equal(list[0]!.id, MIXED_MODULE_ID);
  const m1 = list.find((m) => m.id === 'module-1')!;
  assert.equal(m1.pct, 0);
});
