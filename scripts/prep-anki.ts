import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { DECKS, type DeckEntry } from './anki-decks.config.js';
import { parseApkg } from './anki/parseApkg.js';
import { extractCards } from './anki/extractCards.js';
import { transcodeToOgg } from './anki/transcode.js';

const CACHE_DIR = path.resolve('.cache/anki');
const CONTENT_DIR = path.resolve('content/quiz');
const AUDIO_DIR = path.join(CONTENT_DIR, 'audio');

/** Best-effort AnkiWeb download. Often blocked by CSRF/JS — falls back to manual file. */
async function tryDownload(deck: DeckEntry, dest: string): Promise<boolean> {
  if (!deck.deckId) return false;
  try {
    const res = await fetch(`https://ankiweb.net/svc/shared/download-deck/${deck.deckId}`, {
      method: 'GET',
      headers: { accept: 'application/octet-stream' },
    });
    const ct = res.headers.get('content-type') ?? '';
    if (!res.ok || ct.includes('text/html')) {
      console.warn(`  ⚠ download for ${deck.moduleId} returned ${res.status} ${ct}; use manual file`);
      return false;
    }
    fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch (err) {
    console.warn(`  ⚠ download for ${deck.moduleId} failed: ${(err as Error).message}`);
    return false;
  }
}

async function processDeck(deck: DeckEntry): Promise<void> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const localPath = path.join(CACHE_DIR, deck.localFile);

  if (!fs.existsSync(localPath)) {
    const ok = await tryDownload(deck, localPath);
    if (!ok) {
      console.error(`  ✗ ${deck.moduleId}: no file at ${localPath} and download unavailable. ` +
        `Download the .apkg from AnkiWeb and place it there. Skipping.`);
      return;
    }
  }

  const parsed = parseApkg(localPath);
  const { cards, skipped } = extractCards(deck.moduleId, parsed.notes, deck.mapping ?? {});

  fs.mkdirSync(AUDIO_DIR, { recursive: true });
  for (const card of cards) {
    if (!card.audio) continue;
    const numbered = parsed.mediaByName.get(card.audio);
    if (!numbered) {
      delete card.audio; // referenced clip missing from deck
      continue;
    }
    card.audio = await transcodeToOgg(parsed.mediaBytes(numbered), AUDIO_DIR);
  }

  const module = {
    id: deck.moduleId,
    title: { en: deck.titleEn, ru: deck.titleRu },
    cards,
  };
  fs.mkdirSync(CONTENT_DIR, { recursive: true });
  fs.writeFileSync(path.join(CONTENT_DIR, `${deck.moduleId}.yaml`), YAML.stringify(module), 'utf8');
  console.log(`  ✓ ${deck.moduleId}: ${cards.length} cards (${skipped} skipped), ` +
    `${cards.filter((c) => c.audio).length} with audio`);
}

async function main(): Promise<void> {
  console.log('Preparing Anki quiz content...');
  for (const deck of DECKS) await processDeck(deck);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
