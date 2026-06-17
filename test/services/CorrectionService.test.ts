import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Types } from 'mongoose';
import {
  startMemoryMongo,
  stopMemoryMongo,
  clearMemoryMongo,
} from '../helpers/mongoMemory.js';
import { CorrectionModel } from '../../src/db/corrections.js';
import { CorrectionService } from '../../src/services/CorrectionService.js';
import type { AnthropicService } from '../../src/services/anthropic.js';

class FakeAnthropic {
  public lastCall: { user: string; reply: string } | null = null;
  async correctTurn(user: string, reply: string): Promise<string> {
    this.lastCall = { user, reply };
    return `fixed: ${user}`;
  }
}

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('correctLastTurn persists and returns recap', async () => {
  const fake = new FakeAnthropic();
  const svc = new CorrectionService({ anthropic: fake as unknown as AnthropicService });
  const sessionId = new Types.ObjectId();
  const recap = await svc.correctLastTurn({
    telegramId: 1,
    sessionId,
    userText: 'Mau ke channgu',
    characterReply: 'Berapa orang?',
  });
  assert.match(recap, /fixed/);
  const saved = await CorrectionModel.findOne({ telegramId: 1 }).lean();
  assert.ok(saved);
  assert.equal(saved!.userText, 'Mau ke channgu');
  assert.equal(saved!.characterReply, 'Berapa orang?');
  assert.equal(saved!.recap, 'fixed: Mau ke channgu');
  assert.equal(saved!.sessionId.toString(), sessionId.toString());
});

test('correctLastTurn forwards text and reply to anthropic', async () => {
  const fake = new FakeAnthropic();
  const svc = new CorrectionService({ anthropic: fake as unknown as AnthropicService });
  await svc.correctLastTurn({
    telegramId: 2,
    sessionId: new Types.ObjectId(),
    userText: 'halo',
    characterReply: 'hai',
  });
  assert.ok(fake.lastCall);
  assert.equal(fake.lastCall!.user, 'halo');
  assert.equal(fake.lastCall!.reply, 'hai');
});
