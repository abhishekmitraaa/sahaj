import plainWords from '../../data/plain-words.json';
import { escapeRe } from './glossary';
import { splitSentences } from '../structure/segment';

export interface Piece {
  text: string;
  /** The original wording, when this piece was simplified. */
  was?: string;
}

const DICT = plainWords as Record<string, string>;
// Longest phrases first so "in order to" wins over "order".
const KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);
const DICT_RE = new RegExp(`\\b(${KEYS.map(escapeRe).join('|')})\\b`, 'gi');

const LONG_SENTENCE = 16;
// Places where a long sentence can be cut into two without losing meaning.
const SPLITTERS: { re: RegExp; join: string }[] = [
  { re: /;\s+/, join: '' },
  { re: /,\s+(?:and|but|so)\s+(?=\w)/i, join: '' },
  { re: /,\s+which\s+/i, join: 'This ' },
  { re: /,\s+because\s+/i, join: 'This is because ' },
  { re: /,\s+while\s+/i, join: 'Meanwhile, ' },
  { re: /\s+(?:whereas|although)\s+/i, join: 'But ' },
];

function matchCase(original: string, replacement: string): string {
  if (original === original.toUpperCase() && original.length > 1) return replacement.toUpperCase();
  if (/^[A-Z]/.test(original)) return replacement[0].toUpperCase() + replacement.slice(1);
  return replacement;
}

function swapWords(sentence: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of sentence.matchAll(DICT_RE)) {
    const idx = m.index!;
    if (idx > last) out.push({ text: sentence.slice(last, idx) });
    out.push({ text: matchCase(m[0], DICT[m[0].toLowerCase()]), was: m[0] });
    last = idx + m[0].length;
  }
  if (last < sentence.length) out.push({ text: sentence.slice(last) });
  return out;
}

function splitLong(sentence: string): string[] {
  if (sentence.split(/\s+/).length <= LONG_SENTENCE) return [sentence];
  for (const { re, join } of SPLITTERS) {
    const m = sentence.match(re);
    if (!m || m.index === undefined) continue;
    const head = sentence.slice(0, m.index).trim();
    let tail = sentence.slice(m.index + m[0].length).trim();
    if (head.split(/\s+/).length < 5 || tail.split(/\s+/).length < 4) continue;
    tail = join ? join + tail : tail[0].toUpperCase() + tail.slice(1);
    const headEnd = /[.!?]$/.test(head) ? head : `${head}.`;
    return [...splitLong(headEnd), ...splitLong(tail)];
  }
  return [sentence];
}

/** Rewrite a paragraph in plainer English: shorter sentences, everyday words. */
export function simplify(text: string): { pieces: Piece[]; text: string; changes: number } {
  const pieces: Piece[] = [];
  let changes = 0;
  const sentences = splitSentences(text);
  sentences.forEach((s, i) => {
    const original = text.slice(s.start, s.end);
    const parts = splitLong(original);
    if (parts.length > 1) changes += parts.length - 1;
    parts.forEach((p, j) => {
      const swapped = swapWords(p);
      changes += swapped.filter((x) => x.was).length;
      pieces.push(...swapped);
      if (j < parts.length - 1 || i < sentences.length - 1) pieces.push({ text: ' ' });
    });
  });
  return { pieces, text: pieces.map((p) => p.text).join(''), changes };
}
