import type { Lang, Span } from '../types';

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc', 'fig', 'figs', 'eg', 'ie', 'no',
  'vol', 'pp', 'approx', 'dept', 'est', 'min', 'max', 'cf', 'al', 'ch', 'sec', 'eq',
]);

const DEVANAGARI = /[ऀ-ॿ]/g;
const LATIN = /[A-Za-z]/g;

export function detectLang(text: string): Lang {
  const hi = text.match(DEVANAGARI)?.length ?? 0;
  const en = text.match(LATIN)?.length ?? 0;
  return hi > en ? 'hi' : 'en';
}

/**
 * Split text into sentence ranges. Handles abbreviations (Dr., e.g., Fig. 2),
 * decimals (3.14), initials, and the Hindi danda (। ॥).
 */
export function splitSentences(text: string): Span[] {
  const spans: Span[] = [];
  let start = 0;
  const n = text.length;
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?' && ch !== '।' && ch !== '॥') continue;

    let end = i + 1;
    // Absorb runs like "?!" or "..." and closing quotes/brackets.
    while (end < n && /[.!?।॥"'”’)\]]/.test(text[end])) end++;
    if (end < n && !/\s/.test(text[end])) continue; // "3.14", "e.g.x", "U.S.A"

    if (ch === '.') {
      const before = text.slice(start, i);
      const lastWord = (before.match(/([A-Za-z.]+)$/)?.[1] ?? '').replace(/\./g, '').toLowerCase();
      if (ABBREVIATIONS.has(lastWord)) continue;
      if (/^[A-Z]$/.test(lastWord.toUpperCase()) && lastWord.length === 1) continue; // initials "A. P. J."
      // Next word starting lowercase usually means no sentence break ("approx. two").
      const next = text.slice(end).trimStart();
      if (next && /^[a-z]/.test(next)) continue;
    }

    pushTrimmed(text, start, end, spans);
    start = end;
  }
  if (start < n) pushTrimmed(text, start, n, spans);
  return spans;
}

function pushTrimmed(text: string, start: number, end: number, out: Span[]) {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  if (end > start) out.push({ start, end });
}

export interface WordToken extends Span {
  word: string;
}

const WORD_RE = /[\p{L}\p{M}\p{N}]+(?:['’\-][\p{L}\p{M}\p{N}]+)*/gu;

export function words(text: string): WordToken[] {
  const out: WordToken[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    out.push({ word: m[0], start: m.index!, end: m.index! + m[0].length });
  }
  return out;
}

export function wordCount(text: string): number {
  return text.match(WORD_RE)?.length ?? 0;
}
