import { prop, getModelForClass, modelOptions, index, Severity } from '@typegoose/typegoose';
import { Types } from 'mongoose';
import type { Exercise } from '../services/session/types.js';

@modelOptions({ schemaOptions: { _id: false }, options: { allowMixed: Severity.ALLOW } })
class StoredExercise {
  @prop({ type: String, required: true }) public cardId!: string;
  @prop({ type: String, required: true }) public kind!: Exercise['kind'];
  @prop({ type: String, required: true }) public prompt!: string;
  @prop({ type: () => [String] }) public options?: string[];
  @prop({ type: Number }) public correctIndex?: number;
  @prop({ type: () => [String] }) public tiles?: string[];
  @prop({ type: String, required: true }) public answer!: string;
  @prop({ type: String }) public audioFile?: string;
  @prop({ type: Object, default: {} }) public feedback?: Exercise['feedback'];
}

export type StudyStatus = 'active' | 'completed' | 'expired' | 'abandoned';
export type StudyPhase = 'question' | 'feedback';

@index({ telegramId: 1, status: 1 })
@modelOptions({
  schemaOptions: { collection: 'study_sessions', timestamps: true },
  options: { allowMixed: Severity.ALLOW },
})
export class StudySession {
  public _id!: Types.ObjectId;
  public updatedAt!: Date;

  @prop({ type: Number, required: true }) public telegramId!: number;
  @prop({ type: Number, required: true }) public chatId!: number;
  @prop({ type: String, required: true }) public moduleId!: string;
  @prop({ type: () => [StoredExercise], required: true }) public exercises!: Exercise[];
  @prop({ type: Number, required: true, default: 0 }) public current!: number;
  @prop({ type: Number, required: true, default: 0 }) public correctCount!: number;
  @prop({ type: Number, required: true, default: 0 }) public xpEarned!: number;
  @prop({ type: String, required: true, enum: ['active', 'completed', 'expired', 'abandoned'], default: 'active' })
  public status!: StudyStatus;
  @prop({ type: String, required: true, enum: ['question', 'feedback'], default: 'question' })
  public phase!: StudyPhase;
  @prop({ type: () => [Number], required: true, default: [] }) public builderPicked!: number[];
  @prop({ type: () => [String], required: true, default: [] }) public requeued!: string[];
  @prop({ type: () => [String], required: true, default: [] }) public missed!: string[];
  @prop({ type: Number }) public cardMessageId?: number;
  @prop({ type: Number }) public audioMessageId?: number;
}

export const StudySessionModel = getModelForClass(StudySession);

export class StudySessionsRepo {
  async create(telegramId: number, chatId: number, moduleId: string, exercises: Exercise[]): Promise<StudySession> {
    return (await StudySessionModel.create({ telegramId, chatId, moduleId, exercises })).toObject<StudySession>();
  }

  async findActive(telegramId: number): Promise<StudySession | null> {
    return StudySessionModel.findOne({ telegramId, status: 'active' })
      .sort({ createdAt: -1 })
      .lean<StudySession>();
  }

  async findById(id: Types.ObjectId): Promise<StudySession | null> {
    return StudySessionModel.findOne({ _id: id, status: 'active' }).lean<StudySession>();
  }

  async abandonActive(telegramId: number): Promise<void> {
    await StudySessionModel.updateMany({ telegramId, status: 'active' }, { $set: { status: 'abandoned' } });
  }

  async setMessages(
    id: Types.ObjectId,
    msgs: { cardMessageId?: number; audioMessageId?: number | null },
  ): Promise<void> {
    const set: Record<string, number> = {};
    const unset: Record<string, ''> = {};
    if (msgs.cardMessageId !== undefined) set.cardMessageId = msgs.cardMessageId;
    if (msgs.audioMessageId === null) unset.audioMessageId = '';
    else if (msgs.audioMessageId !== undefined) set.audioMessageId = msgs.audioMessageId;
    const update: Record<string, unknown> = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    await StudySessionModel.updateOne({ _id: id }, update);
  }

  /** wrong answer: enter feedback phase; requeue the card once (appends a fresh exercise).
   *  Guarded on phase so a double-tap race applies at most once. */
  async markWrong(id: Types.ObjectId, cardId: string, requeueExercise: Exercise | null): Promise<boolean> {
    const update: Record<string, unknown> = {
      $set: { phase: 'feedback' },
      $push: requeueExercise
        ? { missed: cardId, exercises: requeueExercise, requeued: cardId }
        : { missed: cardId },
    };
    const res = await StudySessionModel.updateOne({ _id: id, phase: 'question', status: 'active' }, update);
    return res.modifiedCount === 1;
  }

  /** move to the next exercise (after a correct answer or feedback-next).
   *  Guarded on the expected cursor so a double-tap race advances at most once. */
  async advance(
    id: Types.ObjectId,
    res: { correct: boolean; xp: number; expectedCurrent: number },
  ): Promise<boolean> {
    const out = await StudySessionModel.updateOne(
      { _id: id, current: res.expectedCurrent, status: 'active' },
      {
        $inc: { current: 1, correctCount: res.correct ? 1 : 0, xpEarned: res.xp },
        $set: { phase: 'question', builderPicked: [] },
      },
    );
    return out.modifiedCount === 1;
  }

  async pushTile(id: Types.ObjectId, tileIndex: number): Promise<void> {
    await StudySessionModel.updateOne({ _id: id }, { $push: { builderPicked: tileIndex } });
  }

  async popTile(id: Types.ObjectId): Promise<void> {
    await StudySessionModel.updateOne({ _id: id }, { $pop: { builderPicked: 1 } });
  }

  async complete(id: Types.ObjectId, status: Exclude<StudyStatus, 'active'>): Promise<void> {
    await StudySessionModel.updateOne({ _id: id }, { $set: { status } });
  }

  /** active sessions idle since before the cutoff (for the sweeper). */
  async findStale(cutoff: Date): Promise<StudySession[]> {
    return StudySessionModel.find({ status: 'active', updatedAt: { $lt: cutoff } }).lean<StudySession[]>();
  }
}
