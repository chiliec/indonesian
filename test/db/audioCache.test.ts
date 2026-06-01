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

test('voice and audio kinds are independent for the same file', async () => {
  const repo = new AudioCacheRepo();
  await repo.set('x.ogg', 'voice-id', 'voice');
  await repo.set('x.ogg', 'audio-id', 'audio');
  assert.equal(await repo.get('x.ogg', 'voice'), 'voice-id');
  assert.equal(await repo.get('x.ogg', 'audio'), 'audio-id');
});

test('kind defaults to voice for back-compat', async () => {
  const repo = new AudioCacheRepo();
  await repo.set('y.ogg', 'voice-default'); // no kind -> voice
  assert.equal(await repo.get('y.ogg'), 'voice-default'); // no kind -> voice
  assert.equal(await repo.get('y.ogg', 'audio'), null);   // audio kind absent
});
