import type { Types } from 'mongoose';
import type { AnthropicService } from './anthropic.js';
import { CorrectionModel } from '../db/corrections.js';

export interface CorrectionInput {
  telegramId: number;
  sessionId: Types.ObjectId;
  userText: string;
  characterReply: string;
  audioFileId?: string;
}

export interface CorrectionDeps {
  anthropic: AnthropicService;
}

export class CorrectionService {
  constructor(public readonly deps: CorrectionDeps) {}

  async correctLastTurn(input: CorrectionInput): Promise<string> {
    const recap = input.audioFileId
      ? await this.deps.anthropic.correctVoiceTurn(
          input.userText,
          input.characterReply,
        )
      : await this.deps.anthropic.correctTurn(
          input.userText,
          input.characterReply,
        );
    await CorrectionModel.create({
      telegramId: input.telegramId,
      sessionId: input.sessionId,
      userText: input.userText,
      characterReply: input.characterReply,
      recap,
    });
    return recap;
  }
}
