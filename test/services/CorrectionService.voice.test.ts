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
  public textCalls = 0;
  public voiceCalls = 0;
  async correctTurn(_u: string, _r: string, _en: boolean): Promise<string> {
    this.textCalls += 1;
    return 'text-only fix';
  }
  async correctVoiceTurn(_u: string, _r: string, _en: boolean): Promise<string> {
    this.voiceCalls += 1;
    return 'voice fix with pronunciation hint';
  }
}

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(clearMemoryMongo);

test('correctLastTurn dispatches to correctVoiceTurn when audioFileId set', async () => {
  const fake = new FakeAnthropic();
  const svc = new CorrectionService({ anthropic: fake as unknown as AnthropicService });
  const recap = await svc.correctLastTurn({
    telegramId: 1,
    sessionId: new Types.ObjectId(),
    userText: 'mau ke changgu',
    characterReply: 'oke',
    userIsEn: true,
    audioFileId: 'voice123',
  });
  assert.match(recap, /pronunciation/);
  assert.equal(fake.voiceCalls, 1);
  assert.equal(fake.textCalls, 0);
});

test('correctLastTurn falls back to correctTurn when audioFileId absent', async () => {
  const fake = new FakeAnthropic();
  const svc = new CorrectionService({ anthropic: fake as unknown as AnthropicService });
  const recap = await svc.correctLastTurn({
    telegramId: 2,
    sessionId: new Types.ObjectId(),
    userText: 'halo',
    characterReply: 'hai',
    userIsEn: true,
  });
  assert.equal(recap, 'text-only fix');
  assert.equal(fake.textCalls, 1);
  assert.equal(fake.voiceCalls, 0);
});
