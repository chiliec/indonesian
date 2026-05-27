import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';

export interface RawNote {
  id: number;
  fields: string[];
}

export interface ParsedApkg {
  notes: RawNote[];
  /** original media filename -> numbered entry name inside the zip */
  mediaByName: Map<string, string>;
  /** read the raw bytes of a numbered media entry */
  mediaBytes: (numberedName: string) => Buffer;
}

const FIELD_SEP = '\x1f';

export function parseApkg(apkgPath: string): ParsedApkg {
  const zip = new AdmZip(apkgPath);

  const dbEntry =
    zip.getEntry('collection.anki2') ?? zip.getEntry('collection.anki21');
  if (!dbEntry) {
    if (zip.getEntry('collection.anki21b')) {
      throw new Error(
        `${path.basename(apkgPath)} uses the newer zstd/protobuf package format ` +
          `(collection.anki21b). Re-export from Anki with "Support older Anki versions" enabled.`,
      );
    }
    throw new Error(`${path.basename(apkgPath)}: no collection.anki2/anki21 found`);
  }

  // better-sqlite3 needs a file on disk; extract to a temp path.
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'anki-db-'));
  const dbPath = path.join(tmpDir, 'collection.sqlite');
  fs.writeFileSync(dbPath, dbEntry.getData());

  let notes: RawNote[];
  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db.prepare('SELECT id, flds FROM notes').all() as {
        id: number;
        flds: string;
      }[];
      notes = rows.map((r) => ({ id: r.id, fields: r.flds.split(FIELD_SEP) }));
    } finally {
      db.close();
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const mediaEntry = zip.getEntry('media');
  const mediaByName = new Map<string, string>();
  if (mediaEntry) {
    const map = JSON.parse(mediaEntry.getData().toString('utf8')) as Record<string, string>;
    for (const [num, name] of Object.entries(map)) mediaByName.set(name, num);
  }

  const mediaBytes = (numberedName: string): Buffer => {
    const e = zip.getEntry(numberedName);
    if (!e) throw new Error(`media entry ${numberedName} not found in ${path.basename(apkgPath)}`);
    return e.getData();
  };

  return { notes, mediaByName, mediaBytes };
}
