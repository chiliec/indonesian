import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { QuizModule, QuizCard } from './types.js';
import { ModuleSchema } from './cardSchema.js';

export class QuizEngine {
  private constructor(private readonly map: Map<string, QuizModule>) {}

  static async load(dir: string): Promise<QuizEngine> {
    const entries = await fs.readdir(dir);
    const yamls = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const map = new Map<string, QuizModule>();
    for (const f of yamls.sort()) {
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      let parsed: QuizModule;
      try {
        parsed = ModuleSchema.parse(YAML.parse(raw));
      } catch (err) {
        throw new Error(`quiz module ${f} failed validation: ${(err as Error).message}`);
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

  /** every card across all modules, de-duplicated by id (the Mixed pool). */
  allCards(): QuizCard[] {
    const byId = new Map<string, QuizCard>();
    for (const m of this.list()) {
      for (const c of m.cards) if (!byId.has(c.id)) byId.set(c.id, c);
    }
    return Array.from(byId.values());
  }

  /** find a card by id across all modules (used for cross-module summaries). */
  card(id: string): QuizCard | undefined {
    for (const m of this.map.values()) {
      const c = m.cards.find((x) => x.id === id);
      if (c) return c;
    }
    return undefined;
  }
}
