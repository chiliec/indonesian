import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { QuizModule } from './types.js';

export class QuizEngine {
  private constructor(private readonly map: Map<string, QuizModule>) {}

  static async load(dir: string): Promise<QuizEngine> {
    const entries = await fs.readdir(dir);
    const yamls = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const map = new Map<string, QuizModule>();
    for (const f of yamls.sort()) {
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const parsed = YAML.parse(raw) as QuizModule;
      if (!parsed.id) throw new Error(`quiz module ${f} missing id`);
      if (!Array.isArray(parsed.cards) || parsed.cards.length === 0) {
        throw new Error(`quiz module ${parsed.id} has no cards`);
      }
      if (map.has(parsed.id)) throw new Error(`duplicate quiz module id ${parsed.id}`);
      map.set(parsed.id, parsed);
    }
    return new QuizEngine(map);
  }

  get(id: string): QuizModule | undefined {
    return this.map.get(id);
  }

  list(): QuizModule[] {
    return Array.from(this.map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}
