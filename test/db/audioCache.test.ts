import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { AudioCacheRepo } from '../../src/db/audioCache.js';

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('get returns null when absent', async () => {
  const repo = new AudioCacheRepo();
  assert.equal(await repo.get('x.ogg'), null);
});

test('set then get returns file id; set is idempotent (upsert)', async () => {
  const repo = new AudioCacheRepo();
  await repo.set('x.ogg', 'fileid-1');
  assert.equal(await repo.get('x.ogg'), 'fileid-1');
  await repo.set('x.ogg', 'fileid-2');
  assert.equal(await repo.get('x.ogg'), 'fileid-2');
});
