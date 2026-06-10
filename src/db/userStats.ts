import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

@index({ telegramId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'user_stats', timestamps: true } })
export class UserStats {
  @prop({ type: Number, required: true })
  public telegramId!: number;

  @prop({ type: Number, required: true, default: 0 })
  public xp!: number;
}

export const UserStatsModel = getModelForClass(UserStats);

export class UserStatsRepo {
  /** add XP (upsert) and return the new lifetime total. */
  async addXp(telegramId: number, delta: number): Promise<number> {
    const doc = await UserStatsModel.findOneAndUpdate(
      { telegramId },
      { $inc: { xp: delta } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean<UserStats>();
    return doc?.xp ?? 0;
  }

  async get(telegramId: number): Promise<UserStats | null> {
    return UserStatsModel.findOne({ telegramId }).lean<UserStats>();
  }
}
