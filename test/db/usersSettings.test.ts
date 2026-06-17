import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo } from '../../src/db/users.js';

let repo: UsersRepo;
before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  repo = new UsersRepo();
  await repo.touchUser(1);
});

test('speakOptIn defaults false and toggles', async () => {
  assert.equal((await repo.getByTelegramId(1))!.speakOptIn ?? false, false);
  await repo.setSpeakOptIn(1, true);
  assert.equal((await repo.getByTelegramId(1))!.speakOptIn, true);
});

test('sessionLength set and read', async () => {
  await repo.setSessionLength(1, 20);
  assert.equal((await repo.getByTelegramId(1))!.sessionLength, 20);
});
