import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';
import { Types } from 'mongoose';

@index({ telegramId: 1, createdAt: -1 })
@modelOptions({ schemaOptions: { collection: 'corrections', timestamps: true } })
export class CorrectionRecap {
  public _id!: Types.ObjectId;

  @prop({ type: Number, required: true, index: true })
  public telegramId!: number;

  @prop({ type: Types.ObjectId, required: true })
  public sessionId!: Types.ObjectId;

  @prop({ type: String, required: true })
  public userText!: string;

  @prop({ type: String, required: true })
  public characterReply!: string;

  @prop({ type: String, required: true })
  public recap!: string;

  @prop({ type: Date, default: () => new Date() })
  public createdAt!: Date;
}

export const CorrectionModel = getModelForClass(CorrectionRecap);
