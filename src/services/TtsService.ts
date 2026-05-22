import textToSpeech from '@google-cloud/text-to-speech';

export function buildTtsRequest(text: string) {
  return {
    input: { text },
    voice: { languageCode: 'id-ID', name: 'id-ID-Wavenet-A' as const },
    audioConfig: { audioEncoding: 'OGG_OPUS' as const, speakingRate: 0.95 },
  };
}

export class TtsService {
  private client = new textToSpeech.TextToSpeechClient();

  async synthesize(text: string): Promise<Buffer> {
    const [res] = await this.client.synthesizeSpeech(buildTtsRequest(text));
    if (!res.audioContent) throw new Error('no audio content');
    return Buffer.from(res.audioContent as Uint8Array);
  }
}
