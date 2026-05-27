import { prop, getModelForClass, modelOptions, index, Severity } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import type { Question } from '../services/quiz/types.js';

@modelOptions({ schemaOptions: { _id: false }, options: { allowMixed: Severity.ALLOW } })
class StoredQuestion {
  @prop({ type: String, required: true }) public cardId!: string;
  @prop({ type: String, required: true }) public type!: string;
  @prop({ type: String, required: true }) public promptText!: string;
  @prop({ type: String }) public audioFile?: string;
  @prop({ type: () => [String], required: true }) public options!: string[];
  @prop({ type: Number, required: true }) public correctIndex!: number;
  @prop({ type: String, required: true }) public explanation!: string;
}

@index({ telegramId: 1, status: 1 })
@index({ currentPollId: 1 })
@modelOptions({
  schemaOptions: { collection: 'quiz_sessions', timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class QuizSession {
  public _id!: Types.ObjectId;

  @prop({ type: Number, required: true })
  public telegramId!: number;

  @prop({ type: String, required: true })
  public moduleId!: string;

  @prop({ type: () => [StoredQuestion], required: true })
  public questions!: StoredQuestion[];

  @prop({ type: Number, required: true, default: 0 })
  public current!: number;

  @prop({ type: Number, required: true, default: 0 })
  public score!: number;

  @prop({ type: String, required: true, enum: ['active', 'completed', 'abandoned'], default: 'active' })
  public status!: 'active' | 'completed' | 'abandoned';

  @prop({ type: String })
  public currentPollId?: string;

  @prop({ type: () => [String], default: [] })
  public missed!: string[];
}

export const QuizSessionModel = getModelForClass(QuizSession);

export class QuizSessionsRepo {
  async create(telegramId: number, moduleId: string, questions: Question[]): Promise<QuizSession> {
    return QuizSessionModel.create({ telegramId, moduleId, questions });
  }

  async findActive(telegramId: number): Promise<QuizSession | null> {
    return QuizSessionModel.findOne({ telegramId, status: 'active' })
      .sort({ createdAt: -1 })
      .lean<QuizSession>();
  }

  async findByPollId(pollId: string): Promise<QuizSession | null> {
    return QuizSessionModel.findOne({ currentPollId: pollId, status: 'active' }).lean<QuizSession>();
  }

  async setCurrentPoll(id: Types.ObjectId, pollId: string): Promise<void> {
    await QuizSessionModel.updateOne({ _id: id }, { $set: { currentPollId: pollId } });
  }

  async recordAnswer(id: Types.ObjectId, correct: boolean, missedCardId: string | null): Promise<void> {
    const update: Record<string, unknown> = {
      $inc: { current: 1, score: correct ? 1 : 0 },
      $unset: { currentPollId: '' },
    };
    if (missedCardId) update.$push = { missed: missedCardId };
    await QuizSessionModel.updateOne({ _id: id }, update);
  }

  async complete(id: Types.ObjectId): Promise<void> {
    await QuizSessionModel.updateOne({ _id: id }, { $set: { status: 'completed' }, $unset: { currentPollId: '' } });
  }

  async abandonActive(telegramId: number): Promise<void> {
    await QuizSessionModel.updateMany(
      { telegramId, status: 'active' },
      { $set: { status: 'abandoned' }, $unset: { currentPollId: '' } },
    );
  }
}
