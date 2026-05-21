import { getModelForClass, index, modelOptions, prop } from '@typegoose/typegoose';

export type Locale = 'en' | 'ru';
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

  @prop({ type: String, required: true, default: 'en' })
  public locale!: Locale;

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
}

const UserModel = getModelForClass(UserDoc);

export class UsersRepo {
  async upsertByTelegramId(
    telegramId: number,
    init: { locale: Locale },
  ): Promise<UserDoc> {
    const now = new Date();
    const updated = await UserModel.findOneAndUpdate(
      { telegramId },
      {
        $set: { locale: init.locale, lastSeenAt: now },
        $setOnInsert: { plan: 'free', level: 'A0' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<UserDoc>();
    if (!updated) throw new Error('upsert returned null');
    return updated;
  }

  async getByTelegramId(telegramId: number): Promise<UserDoc | null> {
    return UserModel.findOne({ telegramId }).lean<UserDoc>();
  }

  async setLocale(telegramId: number, locale: Locale): Promise<void> {
    await UserModel.updateOne({ telegramId }, { $set: { locale } });
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
}
