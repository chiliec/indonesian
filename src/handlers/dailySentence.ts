import { InlineKeyboard } from 'grammy';
import { t } from '../util/i18n.js';
import type { DailySentenceEntry } from '../services/DailySentenceService.js';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Build the daily-sentence message (HTML) and its 🔄 Another button. */
export function renderDailySentence(
  entry: DailySentenceEntry,
  en: boolean,
): { text: string; keyboard: InlineKeyboard } {
  const text =
    `${t('daily.header', en)}\n\n` +
    `<b>${escapeHtml(entry.text)}</b>\n` +
    `${escapeHtml(entry.en)}`;
  const keyboard = new InlineKeyboard().text(t('daily.another', en), 'ds:another');
  return { text, keyboard };
}
