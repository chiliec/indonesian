import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { QuotaModel } from '../../src/db/quotas.js';
import { QuotaService, utcDayKey } from '../../src/services/QuotaService.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('utcDayKey returns YYYY-MM-DD in UTC', () => {
  assert.equal(utcDayKey(new Date('2026-05-21T15:30:00Z')), '2026-05-21');
  assert.equal(utcDayKey(new Date('2026-05-21T23:59:59Z')), '2026-05-21');
  assert.equal(utcDayKey(new Date('2026-05-22T00:00:01Z')), '2026-05-22');
});

test('QuotaService.tryConsume returns true the first time today, false the second', async () => {
  const svc = new QuotaService();
  const a = await svc.tryConsume(1, new Date('2026-05-21T10:00:00Z'));
  assert.equal(a, true);
  const b = await svc.tryConsume(1, new Date('2026-05-21T22:00:00Z'));
  assert.equal(b, false);
  const docs = await QuotaModel.find({ telegramId: 1 }).lean();
  assert.equal(docs.length, 1);
  assert.equal(docs[0]?.scenariosStarted, 1);
});

test('QuotaService.tryConsume resets next UTC day', async () => {
  const svc = new QuotaService();
  await svc.tryConsume(1, new Date('2026-05-21T10:00:00Z'));
  const c = await svc.tryConsume(1, new Date('2026-05-22T01:00:00Z'));
  assert.equal(c, true);
});
