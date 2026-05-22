import fs from 'node:fs/promises';
import path from 'node:path';
import YAML from 'yaml';
import type { Scenario } from './types.js';

export class ScenarioEngine {
  private constructor(private readonly map: Map<string, Scenario>) {}

  static async load(dir: string): Promise<ScenarioEngine> {
    const entries = await fs.readdir(dir);
    const yamls = entries.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'));
    const map = new Map<string, Scenario>();
    for (const f of yamls.sort()) {
      const raw = await fs.readFile(path.join(dir, f), 'utf8');
      const parsed = YAML.parse(raw) as Scenario;
      if (!parsed.id) throw new Error(`scenario ${f} missing id`);
      if (map.has(parsed.id)) throw new Error(`duplicate scenario id ${parsed.id}`);
      map.set(parsed.id, parsed);
    }
    return new ScenarioEngine(map);
  }

  get(id: string): Scenario | undefined {
    return this.map.get(id);
  }

  list(): Scenario[] {
    return Array.from(this.map.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
}
