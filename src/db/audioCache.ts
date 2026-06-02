import { prop, getModelForClass, modelOptions, index } from '@typegoose/typegoose';

export type AudioKind = 'voice' | 'audio';

// DEPLOY: this replaces the former single-field unique index on `audioFile`.
// On an existing collection the old `audioFile_1` index must be dropped once
// (`db.audio_cache.dropIndex('audioFile_1')`), or it will keep enforcing
// uniqueness on `audioFile` alone and reject a second row for the same file
// under a different `kind`. The collection is a rebuildable cache, so dropping
// the whole collection is also safe.
@index({ audioFile: 1, kind: 1 }, { unique: true })
@modelOptions({ schemaOptions: { collection: 'audio_cache', timestamps: true } })
export class AudioCache {
  @prop({ type: String, required: true })
  public audioFile!: string;

  @prop({ type: String, required: true })
  public fileId!: string;

  @prop({ type: String, required: true, default: 'voice' })
  public kind!: AudioKind;
}

export const AudioCacheModel = getModelForClass(AudioCache);

export class AudioCacheRepo {
  async get(audioFile: string, kind: AudioKind = 'voice'): Promise<string | null> {
    const doc = await AudioCacheModel.findOne({ audioFile, kind }).lean<AudioCache>();
    return doc?.fileId ?? null;
  }

  async set(audioFile: string, fileId: string, kind: AudioKind = 'voice'): Promise<void> {
    await AudioCacheModel.updateOne({ audioFile, kind }, { $set: { fileId } }, { upsert: true });
  }
}
