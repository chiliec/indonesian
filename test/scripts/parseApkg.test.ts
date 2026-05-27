import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';
import { parseApkg } from '../../scripts/anki/parseApkg.js';

// Build a minimal synthetic .apkg in a temp dir.
function makeApkg(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apkg-'));
  const dbPath = path.join(dir, 'collection.anki2');
  const db = new Database(dbPath);
  db.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY, flds TEXT);');
  // Field separator in Anki is the 0x1f unit-separator char.
  const SEP = '\x1f';
  db.prepare('INSERT INTO notes (id, flds) VALUES (?, ?)').run(
    1,
    `pasar${SEP}market${SEP}[sound:greeting1.mp3]`,
  );
  db.prepare('INSERT INTO notes (id, flds) VALUES (?, ?)').run(
    2,
    `rumah${SEP}house${SEP}`,
  );
  db.close();

  const zip = new AdmZip();
  zip.addLocalFile(dbPath, '', 'collection.anki2');
  // media map: numbered file "0" -> original name
  zip.addFile('media', Buffer.from(JSON.stringify({ '0': 'greeting1.mp3' }), 'utf8'));
  zip.addFile('0', Buffer.from('FAKEMP3BYTES'));
  const out = path.join(dir, 'deck.apkg');
  zip.writeZip(out);
  return out;
}

const apkgPath = makeApkg();
after(() => fs.rmSync(path.dirname(apkgPath), { recursive: true, force: true }));

test('parseApkg reads notes flds and media map', () => {
  const parsed = parseApkg(apkgPath);
  assert.equal(parsed.notes.length, 2);
  assert.deepEqual(parsed.notes[0]!.fields, ['pasar', 'market', '[sound:greeting1.mp3]']);
  assert.equal(parsed.mediaByName.get('greeting1.mp3'), '0');
});

test('parseApkg exposes raw media bytes by number', () => {
  const parsed = parseApkg(apkgPath);
  const num = parsed.mediaByName.get('greeting1.mp3')!;
  assert.ok(parsed.mediaBytes(num).length > 0);
});
