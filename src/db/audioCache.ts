import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

@index({ audioFile: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'audio_cache', timestamps: true } })
export class AudioCache {
  @prop({ type: String, required: true })
  public audioFile!: string;

  @prop({ type: String, required: true })
  public fileId!: string;
}

export const AudioCacheModel = getModelForClass(AudioCache);

export class AudioCacheRepo {
  async get(audioFile: string): Promise<string | null> {
    const doc = await AudioCacheModel.findOne({ audioFile }).lean<AudioCache>();
    return doc?.fileId ?? null;
  }

  async set(audioFile: string, fileId: string): Promise<void> {
    await AudioCacheModel.updateOne({ audioFile }, { $set: { fileId } }, { upsert: true });
  }
}
