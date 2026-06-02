import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

const exec = promisify(execFile);

/**
 * Transcode raw MP3 bytes to OGG/Opus and write into `outDir` named by a
 * content hash (dedupes identical clips). Returns the output filename.
 */
export async function transcodeToOgg(mp3: Buffer, outDir: string): Promise<string> {
  const hash = crypto.createHash('sha1').update(mp3).digest('hex').slice(0, 12);
  const outName = `${hash}.ogg`;
  const outPath = path.join(outDir, outName);
  if (fs.existsSync(outPath)) return outName; // already transcoded

  const tmpIn = path.join(os.tmpdir(), `${hash}.mp3`);
  fs.writeFileSync(tmpIn, mp3);
  try {
    await exec('ffmpeg', [
      '-y',
      '-i', tmpIn,
      '-c:a', 'libopus',
      '-b:a', '32k',
      '-ar', '48000',
      '-ac', '1',
      outPath,
    ]);
  } finally {
    fs.rmSync(tmpIn, { force: true });
  }
  return outName;
}
