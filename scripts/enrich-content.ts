// Usage: ANTHROPIC_API_KEY=... GOOGLE_APPLICATION_CREDENTIALS=... \
//   npm run enrich:content -- [--module=module-1] [--force] [--dry-run]
import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import YAML from 'yaml';
import Anthropic from '@anthropic-ai/sdk';
import { MODEL_SONNET } from '../src/services/anthropic.js';
import { TtsService } from '../src/services/TtsService.js';
import { ModuleSchema } from '../src/services/quiz/cardSchema.js';
import type { QuizModule, QuizCard } from '../src/services/quiz/types.js';
import { GeneratedSchema, buildEnrichmentPrompt, applyEnrichment } from './enrich/lib.js';

const CONTENT_DIR = path.resolve('content/quiz');
const AUDIO_DIR = path.join(CONTENT_DIR, 'audio');

const args = process.argv.slice(2);
const onlyModule = args.find((a) => a.startsWith('--module='))?.split('=')[1];
const force = args.includes('--force');
const dryRun = args.includes('--dry-run');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const tts = new TtsService();

async function generate(card: QuizCard) {
  const res = await anthropic.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1000,
    messages: [{ role: 'user', content: buildEnrichmentPrompt(card) }],
  });
  const block = res.content.find((c) => c.type === 'text');
  if (!block || block.type !== 'text') throw new Error('no text block');
  return GeneratedSchema.parse(JSON.parse(block.text.trim()));
}

async function synthesizeSentence(text: string): Promise<string> {
  const buf = await tts.synthesize(text);
  const name = `${createHash('sha256').update(buf).digest('hex').slice(0, 12)}.ogg`;
  await fs.writeFile(path.join(AUDIO_DIR, name), buf);
  return name;
}

async function main() {
  const files = (await fs.readdir(CONTENT_DIR)).filter((f) => f.endsWith('.yaml'));
  let done = 0;
  let skipped = 0;
  let failed = 0;

  for (const f of files.sort()) {
    const mod = ModuleSchema.parse(YAML.parse(await fs.readFile(path.join(CONTENT_DIR, f), 'utf8'))) as QuizModule;
    if (onlyModule && mod.id !== onlyModule) continue;
    let changed = false;

    for (let i = 0; i < mod.cards.length; i++) {
      const card = mod.cards[i]!;
      if (card.sentences?.length && !force) {
        skipped++;
        continue;
      }
      try {
        const gen = await generate(card);
        const audio: (string | null)[] = [];
        for (const s of gen.sentences) {
          audio.push(dryRun ? null : await synthesizeSentence(s.text));
        }
        mod.cards[i] = applyEnrichment(card, gen, audio);
        changed = true;
        done++;
        console.log(`✓ ${card.id} (${card.indonesian})`);
      } catch (err) {
        failed++;
        console.error(`✗ ${card.id}: ${(err as Error).message}`);
      }
    }

    if (changed && !dryRun) {
      await fs.writeFile(path.join(CONTENT_DIR, f), YAML.stringify(mod), 'utf8');
      console.log(`wrote ${f}`);
    } else if (changed) {
      console.log(`[dry-run] would write ${f}`);
    }
  }
  console.log(`\nenriched=${done} skipped=${skipped} failed=${failed}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
