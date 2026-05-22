import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startMemoryMongo, stopMemoryMongo } from '../helpers/mongoMemory.js';
import { SessionsRepo, SessionModel } from '../../src/db/sessions.js';
import { ScenarioEngine } from '../../src/services/scenarios/ScenarioEngine.js';
import { ConversationService } from '../../src/services/ConversationService.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const scenariosDir = path.join(here, '..', '..', 'scenarios');

class FakeAnthropic {
  async respondAsCharacter(_sys: string, msgs: { role: string; content: string }[]) {
    const last = msgs[msgs.length - 1];
    return `echo: ${last?.content ?? ''}`;
  }
  async correctTurn() { return 'no fix'; }
}

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => { await SessionModel.deleteMany({}); });

test('handleUserTurn appends user + assistant turn and returns reply', async () => {
  const sessions = new SessionsRepo();
  const engine = await ScenarioEngine.load(scenariosDir);
  const svc = new ConversationService({ sessions, engine, anthropic: new FakeAnthropic() as any, logger: null as any });
  const { session } = await svc.start(444, 'ojek-to-canggu');
  const result = await svc.handleUserTurn(session._id, 'Halo pak');
  assert.equal(result.characterReply, 'echo: Halo pak');
  const fresh = await sessions.findById(session._id);
  assert.equal(fresh!.turns.length, 3);
  assert.equal(fresh!.turns[1]?.role, 'user');
  assert.equal(fresh!.turns[1]?.text, 'Halo pak');
  assert.equal(fresh!.turns[2]?.role, 'assistant');
});

test('handleUserTurn throws if session ended', async () => {
  const sessions = new SessionsRepo();
  const engine = await ScenarioEngine.load(scenariosDir);
  const svc = new ConversationService({ sessions, engine, anthropic: new FakeAnthropic() as any, logger: null as any });
  const { session } = await svc.start(444, 'ojek-to-canggu');
  await sessions.endSession(session._id, 'user');
  await assert.rejects(() => svc.handleUserTurn(session._id, 'hi'));
});
