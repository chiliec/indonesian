export interface ScenarioBilingual {
  en: string;
  ru: string;
}

export type Difficulty = 'A1' | 'A2' | 'B1';

export interface Scenario {
  id: string;
  title: ScenarioBilingual;
  description: ScenarioBilingual;
  difficulty: Difficulty;
  partnerRole: ScenarioBilingual;
  userGoal: ScenarioBilingual;
  systemPrompt: string;
  opener: string;
  vocabSeed: string[];
  maxTurns: number;
}
