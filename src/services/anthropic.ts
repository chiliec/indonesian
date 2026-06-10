// src/services/anthropic.ts
import Anthropic from '@anthropic-ai/sdk';
import type { Logger } from 'pino';

export const MODEL_SONNET = 'claude-sonnet-4-6';
export const MODEL_HAIKU = 'claude-haiku-4-5-20251001';

export interface AnthropicTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function buildMessageHistory(turns: AnthropicTurn[], limit = 40): AnthropicMessage[] {
  const sliced = turns.slice(-limit);
  return sliced.map((t) => ({ role: t.role, content: t.text }));
}

export interface AnthropicClientDeps {
  apiKey: string;
  logger: Logger;
}

export class AnthropicService {
  private client: Anthropic;

  constructor(private deps: AnthropicClientDeps) {
    this.client = new Anthropic({ apiKey: deps.apiKey });
  }

  async respondAsCharacter(systemPrompt: string, history: AnthropicMessage[]): Promise<string> {
    const res = await this.client.messages.create({
      model: MODEL_SONNET,
      max_tokens: 256,
      system: systemPrompt,
      messages: history,
    });
    const block = res.content.find((c) => c.type === 'text');
    if (!block || block.type !== 'text') throw new Error('no text block in response');
    return block.text.trim();
  }

  async correctTurn(userText: string, characterReply: string, userIsEn: boolean): Promise<string> {
    const sys = `You are an Indonesian-language tutor. The user is practicing Bahasa Indonesia in a role-play.
Given the user's last message in Indonesian, identify 1–3 small fixes (grammar, word choice, naturalness).
For each fix, show:  "❌ wrong → ✅ right" with a one-line explanation in ${userIsEn ? 'English' : 'Russian'}.
If the user's message was already natural, say so in one short line.
Keep total response under 6 lines. Never quote the character's reply.`;
    const res = await this.client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system: sys,
      messages: [
        { role: 'user', content: `User said: "${userText}"\nCharacter replied: "${characterReply}"` },
      ],
    });
    const block = res.content.find((c) => c.type === 'text');
    if (!block || block.type !== 'text') throw new Error('no text block in correction');
    return block.text.trim();
  }

  async correctVoiceTurn(
    userText: string,
    characterReply: string,
    userIsEn: boolean,
  ): Promise<string> {
    const sys = `You are an Indonesian-language tutor. The user spoke (we have their Deepgram transcript).
Identify 1–3 fixes for grammar/word choice AND one pronunciation tip likely to help the learner
(based on common Indonesian-as-second-language pitfalls — final-syllable stress, "ng" sound, the
schwa "e", soft "c" as "ch"). Format: "❌ wrong → ✅ right" then "🔊 Pronunciation tip: …" in
${userIsEn ? 'English' : 'Russian'}. Total under 6 lines.`;
    const res = await this.client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 400,
      system: sys,
      messages: [
        {
          role: 'user',
          content: `User said (transcript): "${userText}"\nCharacter replied: "${characterReply}"`,
        },
      ],
    });
    const block = res.content.find((c) => c.type === 'text');
    if (!block || block.type !== 'text') throw new Error('no text block in voice correction');
    return block.text.trim();
  }

  /** Is the learner's transcript an acceptable spoken rendering of the target? */
  async judgeSpokenAnswer(transcript: string, target: string): Promise<boolean> {
    const res = await this.client.messages.create({
      model: MODEL_HAIKU,
      max_tokens: 5,
      system:
        'You judge Indonesian speaking practice. The learner was asked to say the target phrase. ' +
        'Deepgram transcribed their speech. Answer YES if the transcript is an acceptable rendering ' +
        '(same meaning, minor transcription artifacts, particles like "saya" added) and NO otherwise. ' +
        'Answer with exactly YES or NO.',
      messages: [{ role: 'user', content: `Target: "${target}"\nTranscript: "${transcript}"` }],
    });
    const block = res.content.find((c) => c.type === 'text');
    if (!block || block.type !== 'text') throw new Error('no text block in judge response');
    return block.text.trim().toUpperCase().startsWith('YES');
  }
}
