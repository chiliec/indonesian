import { Keyboard } from 'grammy';

export type KeyboardAction = 'practice' | 'scenarios' | 'progress' | 'settings';

/** Single source of truth for the reply-keyboard labels, per locale. */
const LABELS: Record<KeyboardAction, { en: string; ru: string }> = {
  practice: { en: '▶️ Practice', ru: '▶️ Практика' },
  scenarios: { en: '🎭 Scenarios', ru: '🎭 Сценарии' },
  progress: { en: '📊 Progress', ru: '📊 Прогресс' },
  settings: { en: '⚙️ Settings', ru: '⚙️ Настройки' },
};

/** Reverse lookup built from LABELS — matches a tapped label in either locale. */
const ACTION_BY_LABEL: Map<string, KeyboardAction> = new Map();
for (const [action, l] of Object.entries(LABELS) as [KeyboardAction, { en: string; ru: string }][]) {
  ACTION_BY_LABEL.set(l.en, action);
  ACTION_BY_LABEL.set(l.ru, action);
}

/** The persistent reply keyboard shown beneath the chat. */
export function mainKeyboard(en: boolean): Keyboard {
  const k = (a: KeyboardAction) => (en ? LABELS[a].en : LABELS[a].ru);
  return new Keyboard()
    .text(k('practice')).text(k('scenarios'))
    .row()
    .text(k('progress')).text(k('settings'))
    .resized()
    .persistent();
}

/** Map a tapped button label (either locale) to its action, or null. */
export function matchAction(text: string): KeyboardAction | null {
  return ACTION_BY_LABEL.get(text) ?? null;
}
