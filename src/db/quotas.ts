import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

@index({ telegramId: 1, dayKey: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'quotas', timestamps: true } })
export class Quota {
  @prop({ type: Number, required: true })
  public telegramId!: number;

  @prop({ type: String, required: true })
  public dayKey!: string;

  @prop({ type: Number, required: true, default: 0 })
  public scenariosStarted!: number;
}

export const QuotaModel = getModelForClass(Quota);
