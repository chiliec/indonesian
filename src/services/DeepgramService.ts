import { createClient } from '@deepgram/sdk';
import type { Logger } from 'pino';

export interface DeepgramResult {
  results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
}

export function extractTranscript(res: DeepgramResult): string {
  const alt = res.results?.channels?.[0]?.alternatives?.[0];
  return alt?.transcript?.trim() ?? '';
}

export class DeepgramService {
  private client: ReturnType<typeof createClient>;

  constructor(private deps: { apiKey: string; logger: Logger }) {
    this.client = createClient(deps.apiKey);
  }

  async transcribe(buf: Buffer, mime = 'audio/ogg'): Promise<string> {
    const { result, error } = await this.client.listen.prerecorded.transcribeFile(buf, {
      model: 'nova-3',
      language: 'id',
      mimetype: mime,
    });
    if (error) throw error;
    return extractTranscript(result as DeepgramResult);
  }
}
