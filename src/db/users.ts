import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose';

export type Level = 'A0' | 'A1' | 'A2';
export type Plan = 'free' | 'paid';
export type SubStatus = 'active' | 'expired' | 'cancelled';

@index({ telegramId: 1 }, { unique: true })
@modelOptions({
  schemaOptions: { collection: 'users', versionKey: false, timestamps: true },
})
export class UserDoc {
  @prop({ type: Number, required: true })
  public telegramId!: number;

  @prop({ type: String, required: true, default: 'A0' })
  public level!: Level;

  @prop({ type: String, required: true, default: 'free' })
  public plan!: Plan;

  @prop({ type: String })
  public subscriptionStatus?: SubStatus;

  @prop({ type: Date })
  public subscriptionPeriodEnd?: Date;

  @prop({ type: String })
  public telegramStarsSubscriptionId?: string;

  @prop({ type: Date, default: () => new Date() })
  public lastSeenAt!: Date;

  /** speaking exercises are opt-in (awkward in public places) */
  @prop({ type: Boolean })
  public speakOptIn?: boolean;

  /** questions per practice session (5 | 10 | 20); unset = 10 */
  @prop({ type: Number })
  public sessionLength?: number;

  /** daily sentence push disabled when true; unset/false = enabled */
  @prop({ type: Boolean })
  public dailySentenceOptOut?: boolean;

  /** timestamp of the last daily-sentence push (once-per-UTC-day guard) */
  @prop({ type: Date })
  public lastDailySentenceAt?: Date;

  /** recently-shown sentence IDs, to avoid repeats until the pool is exhausted */
  @prop({ type: [String], default: undefined })
  public seenSentenceIds?: string[];
}

export const UserModel = getModelForClass(UserDoc);

export class UsersRepo {
  async upsertByTelegramId(telegramId: number): Promise<UserDoc> {
    const now = new Date();
    const updated = await UserModel.findOneAndUpdate(
      { telegramId },
      {
        $set: { lastSeenAt: now },
        $setOnInsert: { plan: 'free', level: 'A0' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<UserDoc>();
    if (!updated) throw new Error('upsert returned null');
    return updated;
  }

  async touchUser(telegramId: number): Promise<UserDoc> {
    const now = new Date();
    const updated = await UserModel.findOneAndUpdate(
      { telegramId },
      {
        $set: { lastSeenAt: now },
        $setOnInsert: { plan: 'free', level: 'A0' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<UserDoc>();
    if (!updated) throw new Error('touchUser returned null');
    return updated;
  }

  async getByTelegramId(telegramId: number): Promise<UserDoc | null> {
    return UserModel.findOne({ telegramId }).lean<UserDoc>();
  }

  async setPlanPaid(
    telegramId: number,
    opts: { periodEnd: Date; telegramStarsSubscriptionId?: string },
  ): Promise<void> {
    await UserModel.updateOne(
      { telegramId },
      {
        $set: {
          plan: 'paid',
          subscriptionStatus: 'active',
          subscriptionPeriodEnd: opts.periodEnd,
          telegramStarsSubscriptionId: opts.telegramStarsSubscriptionId,
        },
      },
    );
  }

  async expirePlan(telegramId: number): Promise<void> {
    await UserModel.updateOne(
      { telegramId },
      { $set: { plan: 'free', subscriptionStatus: 'expired' } },
    );
  }

  async setSpeakOptIn(telegramId: number, on: boolean): Promise<void> {
    await UserModel.updateOne({ telegramId }, { $set: { speakOptIn: on } });
  }

  async setSessionLength(telegramId: number, n: number): Promise<void> {
    await UserModel.updateOne({ telegramId }, { $set: { sessionLength: n } });
  }

  async setDailySentenceOptOut(telegramId: number, on: boolean): Promise<void> {
    await UserModel.updateOne({ telegramId }, { $set: { dailySentenceOptOut: on } });
  }

  async recordDailySentenceSent(
    telegramId: number,
    sentAt: Date,
    seenIds: string[],
  ): Promise<void> {
    await UserModel.updateOne(
      { telegramId },
      { $set: { lastDailySentenceAt: sentAt, seenSentenceIds: seenIds } },
    );
  }

  async findDailySentenceCandidates(opts: {
    activeSince: Date;
    dayStart: Date;
  }): Promise<UserDoc[]> {
    return UserModel.find({
      dailySentenceOptOut: { $ne: true },
      lastSeenAt: { $gte: opts.activeSince },
      $or: [
        { lastDailySentenceAt: { $exists: false } },
        { lastDailySentenceAt: { $lt: opts.dayStart } },
      ],
    }).lean<UserDoc[]>();
  }
}
