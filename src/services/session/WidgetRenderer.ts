import type { Exercise } from './types.js';
import type { QuestionView, FinishView } from './ExerciseRenderer.js';

export const MAX_STATE_BYTES = 1024;
const MAX_FINISH_LINES = 8;

interface Fb { w?: string; e?: string; s?: string; se?: string; nt?: string }
type State = Record<string, unknown> & { fb?: Fb; nw?: string[]; mw?: string[]; more?: number };

const size = (o: State): number => Buffer.byteLength(JSON.stringify(o));

function fit(o: State): string {
  if (size(o) > MAX_STATE_BYTES && o.fb) delete o.fb.nt;
  if (size(o) > MAX_STATE_BYTES && o.fb) { delete o.fb.s; delete o.fb.se; }
  for (const key of ['mw', 'nw'] as const) {
    while (size(o) > MAX_STATE_BYTES && o[key]?.length) { o[key]!.pop(); o.more = (o.more ?? 0) + 1; }
  }
  if (size(o) > MAX_STATE_BYTES) throw new Error(`widget state over ${MAX_STATE_BYTES} bytes: k=${String(o.k)}`);
  return JSON.stringify(o);
}

function fbOf(ex: Exercise): Fb {
  const f = ex.feedback ?? {};
  const fb: Fb = {};
  if (f.word && f.wordEn) { fb.w = f.word; fb.e = f.wordEn; }
  if (f.sentence) { fb.s = f.sentence; fb.se = f.sentenceEn ?? ''; }
  if (f.note) fb.nt = f.note;
  return fb;
}

const head = (v: QuestionView) => ({ q: v.cursor, i: v.index, n: v.total, xp: v.xpTotal });

export function renderWidgetQuestion(v: QuestionView, ex: Exercise): string {
  const o: State = { k: ex.kind, ...head(v), p: ex.prompt };
  if (v.flash?.correct) {
    const l = v.flash.corrected ? `Almost — correct spelling: ${v.flash.corrected}` : v.flash.label ?? 'Benar!';
    o.fl = { x: v.flash.xp, l };
  }
  if ((ex.kind === 'choice' || ex.kind === 'cloze') && ex.options) {
    o.o = ex.options; o.c = ex.correctIndex; o.a = ex.answer; o.fb = fbOf(ex);
  }
  if (ex.kind === 'builder' && ex.tiles) { o.t = ex.tiles; o.a = ex.answer; o.fb = fbOf(ex); }
  return fit(o);
}

export function renderWidgetFeedback(v: QuestionView, ex: Exercise): string {
  return fit({ k: 'feedback', ...head(v), a: ex.answer, fb: fbOf(ex) });
}

export function renderWidgetFinish(f: FinishView, expired = false): string {
  const o: State = {
    k: 'finish', sc: f.correctCount, tot: f.total, xe: f.xpEarned,
    nw: [...f.newWords], mw: f.missedWords.slice(0, MAX_FINISH_LINES), due: f.dueTomorrow,
  };
  if (f.missedWords.length > MAX_FINISH_LINES) o.more = f.missedWords.length - MAX_FINISH_LINES;
  if (expired) o.ex = 1;
  return fit(o);
}
