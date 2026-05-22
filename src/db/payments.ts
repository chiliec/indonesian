import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

@index({ telegramChargeId: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'payments', timestamps: true } })
export class Payment {
  @prop({ type: Number, required: true, index: true })
  public telegramId!: number;

  @prop({ type: String, required: true })
  public telegramChargeId!: string;

  @prop({ type: Number, required: true })
  public starsAmount!: number;

  @prop({ type: String, required: true })
  public payload!: string;

  @prop({ type: Date, default: () => new Date() })
  public paidAt!: Date;
}

export const PaymentModel = getModelForClass(Payment);
