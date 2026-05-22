import { prop, getModelForClass, modelOptions, index, Severity } from '@typegoose/typegoose';
import { Types } from 'mongoose';

@modelOptions({ schemaOptions: { _id: false } })
class Turn {
  @prop({ type: String, required: true, enum: ['user', 'assistant'] })
  public role!: 'user' | 'assistant';

  @prop({ type: String, required: true })
  public text!: string;

  @prop({ type: Date, default: () => new Date() })
  public at!: Date;

  @prop({ type: String })
  public audioFileId?: string;
}

@index({ telegramId: 1, status: 1, startedAt: -1 })
@modelOptions({
  schemaOptions: { collection: 'sessions', timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class ConversationSession {
  public _id!: Types.ObjectId;

  @prop({ type: Number, required: true, index: true })
  public telegramId!: number;

  @prop({ type: String, required: true })
  public scenarioId!: string;

  @prop({ type: String, required: true, enum: ['active', 'ended'], default: 'active' })
  public status!: 'active' | 'ended';

  @prop({ type: String, enum: ['user', 'stale', 'maxTurns', 'auto'] })
  public endReason?: 'user' | 'stale' | 'maxTurns' | 'auto';

  @prop({ type: () => [Turn], default: [] })
  public turns!: Turn[];

  @prop({ type: Date, default: () => new Date() })
  public startedAt!: Date;

  @prop({ type: Date })
  public endedAt?: Date;

  @prop({ type: Number, default: 0 })
  public correctionCount!: number;
}

export const SessionModel = getModelForClass(ConversationSession);

export interface CreateSessionInput {
  telegramId: number;
  scenarioId: string;
  opener: string;
}

export interface AppendTurnInput {
  role: 'user' | 'assistant';
  text: string;
  audioFileId?: string;
}

export class SessionsRepo {
  async create(input: CreateSessionInput): Promise<ConversationSession> {
    return SessionModel.create({
      telegramId: input.telegramId,
      scenarioId: input.scenarioId,
      turns: [{ role: 'assistant', text: input.opener, at: new Date() }],
    });
  }

  async appendTurn(id: Types.ObjectId, turn: AppendTurnInput): Promise<void> {
    await SessionModel.updateOne(
      { _id: id },
      { $push: { turns: { ...turn, at: new Date() } } },
    );
  }

  async findActive(telegramId: number): Promise<ConversationSession | null> {
    return SessionModel.findOne({ telegramId, status: 'active' })
      .sort({ startedAt: -1 })
      .lean<ConversationSession>();
  }

  async findById(id: Types.ObjectId): Promise<ConversationSession | null> {
    return SessionModel.findById(id).lean<ConversationSession>();
  }

  async endSession(id: Types.ObjectId, reason: 'user' | 'stale' | 'maxTurns' | 'auto'): Promise<void> {
    await SessionModel.updateOne(
      { _id: id },
      { $set: { status: 'ended', endReason: reason, endedAt: new Date() } },
    );
  }
}
