import type { CardView, Exercise } from './types.js';
import { escapeHtml } from './html.js';
export { escapeHtml } from './html.js';

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

function header(v: QuestionView): string {
  const filled = Math.round((v.index / v.total) * 10);
  const bar = '▰'.repeat(filled) + '▱'.repeat(10 - filled);
  return `🎯 <b>Practice</b> · ${bar} ${v.index + 1}/${v.total}\n⭐ ${v.xpTotal} XP`;
}

function flashLine(v: QuestionView): string {
  if (!v.flash) return '';
  if (!v.flash.correct) return '';
  const base = v.flash.corrected
    ? `✅ Almost — correct spelling: <i>${escapeHtml(v.flash.corrected)}</i>`
    : '✅ Benar!';
  return `\n${base} +${v.flash.xp} XP`;
}

export function renderQuestion(v: QuestionView, ex: Exercise): CardView {
  const parts = [header(v), flashLine(v), '', ex.prompt];
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
    parts.push('', `So far: <b>${escapeHtml(picked || '—')}</b>`);
    const unpicked = ex.tiles
      .map((w, i) => ({ w, i }))
      .filter(({ i }) => !v.builderPicked.includes(i));
    for (let r = 0; r < unpicked.length; r += 3) {
      buttons.push(unpicked.slice(r, r + 3).map(({ w, i }) => ({ text: w, data: `s:${v.sessionId}:t:${i}` })));
    }
    if (v.builderPicked.length > 0) {
      buttons.push([{ text: '↩️ Undo', data: `s:${v.sessionId}:u` }]);
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

export function renderFeedback(v: QuestionView, ex: Exercise): CardView {
  const parts = [header(v), '', `❌ Not quite. Correct answer: <b>${escapeHtml(ex.answer)}</b>`];
  if (ex.feedback.sentence) {
    parts.push(`📖 <i>${escapeHtml(ex.feedback.sentence)}</i> — ${escapeHtml(ex.feedback.sentenceEn ?? '')}`);
  }
  if (ex.feedback.note) parts.push(`💡 ${escapeHtml(ex.feedback.note)}`);
  return {
    text: parts.join('\n'),
    buttons: [[{ text: '▶️ Next', data: `s:${v.sessionId}:n` }]],
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

export function renderFinish(f: FinishView): CardView {
  const parts = [
    '🏁 Session done!',
    `✅ ${f.correctCount}/${f.total} · ⭐ +${f.xpEarned} XP`,
  ];
  if (f.missedWords.length) {
    parts.push('', 'Words to review:', ...f.missedWords.map((w) => `• ${escapeHtml(w)}`));
  }
  return {
    text: parts.join('\n'),
    buttons: [[{ text: '▶️ Practice again', data: 'p:again' }]],
    finished: true,
  };
}
