import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startMemoryMongo, stopMemoryMongo, clearMemoryMongo } from '../helpers/mongoMemory.js';
import { UsersRepo } from '../../src/db/users.js';
import { settingsRichCallback } from '../../src/handlers/settings.js';

let repo: UsersRepo;
before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => {
  await clearMemoryMongo();
  repo = new UsersRepo();
  await repo.touchUser(1);
});

test('settingsRichCallback toggles richCards off → on → off and shows the state', async () => {
  const labels: string[] = [];
  const ctx = {
    from: { id: 1 },
    deps: { usersRepo: repo },
    answerCallbackQuery: async () => {},
    reply: async (_text: string, opts: { reply_markup: { inline_keyboard: { text: string }[][] } }) => {
      labels.push(opts.reply_markup.inline_keyboard.flat().map((b) => b.text).join('|'));
    },
  } as never;

  await settingsRichCallback(ctx);
  assert.equal((await repo.getByTelegramId(1))!.richCards, true);
  assert.ok(labels[0]!.includes('✨ Rich cards: ON'));
  await settingsRichCallback(ctx);
  assert.equal((await repo.getByTelegramId(1))!.richCards, false);
  assert.ok(labels[1]!.includes('✨ Rich cards: OFF'));
});
