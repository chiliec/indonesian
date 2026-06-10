import { t } from '../../util/i18n.js';
import type { CardView, Exercise } from './types.js';

export interface QuestionView {
  sessionId: string;
  /** 0-based index of the current exercise */
  index: number;
  total: number;
  /** user lifetime XP (shown in header) */
  xpTotal: number;
  correctCount: number;
  builderPicked: number[];
  /** result of the previous answer, flashed above the question */
  flash?: { correct: boolean; xp: number; corrected?: string };
}

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function header(v: QuestionView, en: boolean): string {
  const filled = Math.round((v.index / v.total) * 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  const title = en ? '🎯 <b>Practice</b>' : '🎯 <b>Практика</b>';
  return `${title} · ${bar} ${v.index + 1}/${v.total}\n⭐ ${v.xpTotal} XP`;
}

function flashLine(v: QuestionView, en: boolean): string {
  if (!v.flash) return '';
  if (!v.flash.correct) return '';
  const base = v.flash.corrected
    ? `${t('session.almost', en)} <i>${escapeHtml(v.flash.corrected)}</i>`
    : t('session.correct', en);
  return `\n${base} +${v.flash.xp} XP`;
}

export function renderQuestion(v: QuestionView, ex: Exercise, en: boolean): CardView {
  const parts = [header(v, en), flashLine(v, en), '', ex.prompt];
  const buttons: CardView['buttons'] = [];

  if ((ex.kind === 'choice' || ex.kind === 'cloze') && ex.options) {
    for (let i = 0; i < ex.options.length; i += 2) {
      const row = [{ text: ex.options[i]!, data: `s:${v.sessionId}:a:${i}` }];
      if (ex.options[i + 1]) row.push({ text: ex.options[i + 1]!, data: `s:${v.sessionId}:a:${i + 1}` });
      buttons.push(row);
    }
  }

  if (ex.kind === 'builder' && ex.tiles) {
    const picked = v.builderPicked.map((i) => ex.tiles![i]).join(' ');
    parts.push('', `${t('session.soFar', en)} <b>${escapeHtml(picked || '—')}</b>`);
    const unpicked = ex.tiles
      .map((w, i) => ({ w, i }))
      .filter(({ i }) => !v.builderPicked.includes(i));
    for (let r = 0; r < unpicked.length; r += 3) {
      buttons.push(unpicked.slice(r, r + 3).map(({ w, i }) => ({ text: w, data: `s:${v.sessionId}:t:${i}` })));
    }
    if (v.builderPicked.length > 0) {
      buttons.push([{ text: t('session.undo', en), data: `s:${v.sessionId}:u` }]);
    }
  }

  const view: CardView = {
    text: parts.filter((p, i) => p !== '' || i > 0).join('\n').replace(/\n{3,}/g, '\n\n'),
    buttons,
    finished: false,
  };
  if (ex.audioFile) view.audioFile = ex.audioFile;
  return view;
}

export function renderFeedback(v: QuestionView, ex: Exercise, en: boolean): CardView {
  const parts = [header(v, en), '', `${t('session.wrong', en)} <b>${escapeHtml(ex.answer)}</b>`];
  if (ex.feedback.sentence) {
    parts.push(`📖 <i>${escapeHtml(ex.feedback.sentence)}</i> — ${escapeHtml(ex.feedback.sentenceEn ?? '')}`);
  }
  if (ex.feedback.note) parts.push(`💡 ${escapeHtml(ex.feedback.note)}`);
  return {
    text: parts.join('\n'),
    buttons: [[{ text: t('session.next', en), data: `s:${v.sessionId}:n` }]],
    finished: false,
  };
}

export interface FinishView {
  correctCount: number;
  total: number;
  xpEarned: number;
  /** "indonesian — english" lines for missed cards */
  missedWords: string[];
}

export function renderFinish(f: FinishView, en: boolean): CardView {
  const parts = [
    t('session.done', en),
    `✅ ${f.correctCount}/${f.total} · ⭐ +${f.xpEarned} XP`,
  ];
  if (f.missedWords.length) {
    parts.push('', t('session.review', en), ...f.missedWords.map((w) => `• ${escapeHtml(w)}`));
  }
  return {
    text: parts.join('\n'),
    buttons: [[{ text: t('session.again', en), data: 'p:again' }]],
    finished: true,
  };
}
