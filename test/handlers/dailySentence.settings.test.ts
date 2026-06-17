import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo } from '../../src/db/users.js';
import { settingsDailyCallback } from '../../src/handlers/settings.js';

let repo: UsersRepo;
before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  repo = new UsersRepo();
  await repo.touchUser(1);
});

test('settingsDailyCallback toggles opt-out from on → off → on', async () => {
  const ctx = {
    from: { id: 1 },
    deps: { usersRepo: repo },
    answerCallbackQuery: async () => {},
    reply: async () => {},
  } as never;

  // starts enabled (opt-out unset) → first toggle disables (opt-out true)
  await settingsDailyCallback(ctx);
  assert.equal((await repo.getByTelegramId(1))!.dailySentenceOptOut, true);
  // second toggle re-enables
  await settingsDailyCallback(ctx);
  assert.equal((await repo.getByTelegramId(1))!.dailySentenceOptOut, false);
});
