import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

@index({ telegramId: 1, cardId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'quiz_progress', timestamps: true } })
export class QuizProgress {
  @prop({ type: Number, required: true })
  public telegramId!: number;

  @prop({ type: String, required: true })
  public cardId!: string;

  @prop({ type: Number, required: true, default: 0 })
  public seen!: number;

  @prop({ type: Number, required: true, default: 0 })
  public correct!: number;

  @prop({ type: Number, required: true, default: 0 })
  public wrong!: number;

  @prop({ type: String, enum: ['correct', 'wrong'] })
  public lastResult?: 'correct' | 'wrong';

  @prop({ type: Date })
  public lastSeenAt?: Date;
}

export const QuizProgressModel = getModelForClass(QuizProgress);

export class QuizProgressRepo {
  async record(telegramId: number, cardId: string, correct: boolean): Promise<void> {
    await QuizProgressModel.updateOne(
      { telegramId, cardId },
      {
        $inc: { seen: 1, correct: correct ? 1 : 0, wrong: correct ? 0 : 1 },
        $set: { lastResult: correct ? 'correct' : 'wrong', lastSeenAt: new Date() },
      },
      { upsert: true },
    );
  }

  async forCards(telegramId: number, cardIds: string[]): Promise<Map<string, QuizProgress>> {
    const docs = await QuizProgressModel.find({
      telegramId,
      cardId: { $in: cardIds },
    }).lean<QuizProgress[]>();
    return new Map(docs.map((d) => [d.cardId, d]));
  }
}
