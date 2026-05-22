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

before(startMemoryMongo);
after(stopMemoryMongo);
beforeEach(async () => { await SessionModel.deleteMany({}); });

test('start() creates session, returns opener text', async () => {
  const sessions = new SessionsRepo();
  const engine = await ScenarioEngine.load(scenariosDir);
  const svc = new ConversationService({ sessions, engine, anthropic: null as any, logger: null as any });
  const { session, opener } = await svc.start(111, 'ojek-to-canggu');
  assert.equal(session.scenarioId, 'ojek-to-canggu');
  assert.ok(opener.length > 0);
  assert.equal(session.turns[0]?.text, opener);
});

test('start() throws when scenarioId unknown', async () => {
  const sessions = new SessionsRepo();
  const engine = await ScenarioEngine.load(scenariosDir);
  const svc = new ConversationService({ sessions, engine, anthropic: null as any, logger: null as any });
  await assert.rejects(() => svc.start(111, 'no-such'));
});
