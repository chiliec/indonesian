/** lowercase, strip diacritics & punctuation, collapse whitespace. */
export function normalizeAnswer(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** classic Levenshtein DP. */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i, ...new Array<number>(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = cur;
  }
  return prev[n]!;
}

export type MatchResult = 'exact' | 'close' | 'wrong';

/** exact after normalization; edit distance 1 counts as "close" (still correct). */
export function matchAnswer(input: string, target: string): MatchResult {
  const a = normalizeAnswer(input);
  const b = normalizeAnswer(target);
  if (!a) return 'wrong';
  if (a === b) return 'exact';
  if (editDistance(a, b) === 1) return 'close';
  return 'wrong';
}
