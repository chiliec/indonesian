import { Keyboard } from 'grammy';

export type KeyboardAction = 'practice' | 'scenarios' | 'progress' | 'settings';

/** Single source of truth for the reply-keyboard labels. */
const LABELS: Record<KeyboardAction, string> = {
  practice: '▶️ Practice',
  scenarios: '🎭 Scenarios',
  progress: '📊 Progress',
  settings: '⚙️ Settings',
};

/** Reverse lookup built from LABELS — matches a tapped label to its action. */
const ACTION_BY_LABEL: Map<string, KeyboardAction> = new Map();
for (const [action, label] of Object.entries(LABELS) as [KeyboardAction, string][]) {
  ACTION_BY_LABEL.set(label, action);
}

/** The persistent reply keyboard shown beneath the chat. */
export function mainKeyboard(): Keyboard {
  return new Keyboard()
    .text(LABELS.practice).text(LABELS.scenarios)
    .row()
    .text(LABELS.progress).text(LABELS.settings)
    .resized()
    .persistent();
}

/** Map a tapped button label to its action, or null. */
export function matchAction(text: string): KeyboardAction | null {
  return ACTION_BY_LABEL.get(text) ?? null;
}
