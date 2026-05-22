import type { Logger } from 'pino';
import type { Types } from 'mongoose';
import type { SessionsRepo, ConversationSession } from '../db/sessions.js';
import type { ScenarioEngine } from './scenarios/ScenarioEngine.js';
import type { AnthropicService } from './anthropic.js';
import { buildMessageHistory } from './anthropic.js';

export interface ConversationDeps {
  sessions: SessionsRepo;
  engine: ScenarioEngine;
  anthropic: AnthropicService;
  logger: Logger;
}

export class ConversationService {
  constructor(public readonly deps: ConversationDeps) {}

  async start(
    telegramId: number,
    scenarioId: string,
  ): Promise<{ session: ConversationSession; opener: string }> {
    const scenario = this.deps.engine.get(scenarioId);
    if (!scenario) throw new Error(`unknown scenario: ${scenarioId}`);
    const session = await this.deps.sessions.create({
      telegramId,
      scenarioId,
      opener: scenario.opener,
    });
    return { session, opener: scenario.opener };
  }

  async handleUserTurn(
    sessionId: Types.ObjectId,
    userText: string,
  ): Promise<{ characterReply: string; turnCount: number }> {
    const session = await this.deps.sessions.findById(sessionId);
    if (!session) throw new Error('session not found');
    if (session.status !== 'active') throw new Error('session not active');
    const scenario = this.deps.engine.get(session.scenarioId);
    if (!scenario) throw new Error(`scenario gone: ${session.scenarioId}`);

    await this.deps.sessions.appendTurn(sessionId, { role: 'user', text: userText });

    const history = buildMessageHistory(
      [...session.turns, { role: 'user', text: userText }],
      40,
    );
    const reply = await this.deps.anthropic.respondAsCharacter(scenario.systemPrompt, history);
    await this.deps.sessions.appendTurn(sessionId, { role: 'assistant', text: reply });
    const turnCount = session.turns.length + 2;
    return { characterReply: reply, turnCount };
  }
}
