import type { Block } from '../types';
import { words } from '../structure/segment';
import { STOPWORDS, stem } from './tokenize';

export interface GlossaryEntry {
  term: string;
  /** Sentence from the document that defines (or best explains) the term. */
  definition: string;
  defined: boolean;
  blockId: string;
  occurrences: number;
}

const PRONOUNS = /^(it|this|that|these|those|they|he|she|we|you|there|here|which|what|one|each|such|all|some|both)$/i;
const ARTICLE = /^(?:the|a|an)\s+/i;
const TERM = String.raw`([A-Za-z][A-Za-z\-]*(?:\s+[A-Za-z][A-Za-z\-]*){0,3})`;

const PATTERNS: { re: RegExp; group: number }[] = [
  // "... is called transpiration." / "... are known as stomata"
  { re: new RegExp(String.raw`\b(?:is|are|was|were)\s+(?:also\s+)?(?:called|known\s+as|termed|named)\s+(?:the\s+|a\s+|an\s+)?` + TERM + String.raw`(?=[\s,.;:()]|$)`, 'i'), group: 1 },
  // "Chlorophyll refers to ..." / "X means ..." / "X is defined as ..."
  { re: new RegExp('^' + String.raw`(?:the\s+|a\s+|an\s+)?` + TERM + String.raw`\s+(?:refers?\s+to|means|is\s+defined\s+as|are\s+defined\s+as|stands\s+for)\b`, 'i'), group: 1 },
  // "Chlorophyll is a green pigment ..." (definition-shaped: "is a/an/the")
  { re: new RegExp('^' + String.raw`(?:the\s+)?` + TERM + String.raw`\s+(?:is|are)\s+(?:a|an|the|tiny|small|special)\s+`, 'i'), group: 1 },
  // "... a sugar called glucose", "thin tubes called xylem" (single-word terms only)
  { re: /\b[a-z]+\s+(?:called|named|known\s+as)\s+([A-Za-z][A-Za-z\-]{2,})(?=[\s,.;:()]|$)/i, group: 1 },
];

const DEV = String.raw`[ऀ-ॿ]+`;
// Hindi: "इस प्रक्रिया को प्रकाश संश्लेषण कहते हैं", "जिन्हें रंध्र कहते हैं", "क्लोरोफिल नामक एक हरा वर्णक"
const HINDI_PATTERNS: RegExp[] = [
  new RegExp(String.raw`(?:को|जिन्हें|जिसे|इसे|इन्हें|उसे)\s+(${DEV}(?:\s+${DEV})?)\s+कहते\s+हैं`),
  new RegExp(String.raw`(${DEV})\s+नामक`),
];

const isHindi = (s: string) => /[ऀ-ॿ]/.test(s);

function cleanTerm(raw: string): string | null {
  let t = raw.trim().replace(ARTICLE, '').replace(/[,.;:]+$/, '');
  // Trim trailing function words that the greedy pattern swept up.
  const parts = t.split(/\s+/);
  while (parts.length && STOPWORDS.has(parts[parts.length - 1].toLowerCase())) parts.pop();
  while (parts.length && STOPWORDS.has(parts[0].toLowerCase())) parts.shift();
  t = parts.join(' ');
  if (!t || t.length < 3 || PRONOUNS.test(t) || parts.length > 3) return null;
  return t.toLowerCase();
}

/** Mine "X is called Y" / "Y is a ..." style definitions (English and Hindi) from the document itself. */
export function mineDefinitions(blocks: Block[]): Map<string, { definition: string; blockId: string }> {
  const out = new Map<string, { definition: string; blockId: string }>();
  for (const b of blocks) {
    if (b.type === 'heading') continue;
    for (const s of b.sentences) {
      const sentence = b.text.slice(s.start, s.end);
      if (sentence.length > 320) continue;
      if (b.lang === 'hi') {
        for (const re of HINDI_PATTERNS) {
          const term = sentence.match(re)?.[1];
          if (term && !out.has(term)) out.set(term, { definition: sentence, blockId: b.id });
        }
        continue;
      }
      for (const { re, group } of PATTERNS) {
        const m = sentence.match(re);
        if (!m) continue;
        const term = cleanTerm(m[group]);
        if (!term) continue;
        if (!out.has(term)) out.set(term, { definition: sentence, blockId: b.id });
        break;
      }
    }
  }
  return out;
}

interface Candidate {
  display: string;
  count: number;
  blocks: Set<string>;
  firstBlock: string;
}

/** Key terms: frequent, specific unigrams and bigrams, plus every mined definition. */
export function buildGlossary(blocks: Block[], limit = 18): GlossaryEntry[] {
  const defs = mineDefinitions(blocks);
  const cands = new Map<string, Candidate>();
  const body = blocks.filter((b) => b.lang === 'en');
  const add = (key: string, display: string, blockId: string) => {
    const c = cands.get(key) ?? { display, count: 0, blocks: new Set<string>(), firstBlock: blockId };
    c.count++;
    c.blocks.add(blockId);
    cands.set(key, c);
  };
  for (const b of body) {
    const ws = words(b.text).map((w) => w.word);
    for (let i = 0; i < ws.length; i++) {
      const w = ws[i].toLowerCase();
      if (STOPWORDS.has(w) || w.length < 4 || /\d/.test(w)) continue;
      add(stem(w), w, b.id);
      const next = ws[i + 1]?.toLowerCase();
      if (next && !STOPWORDS.has(next) && next.length >= 3 && !/\d/.test(next)) {
        add(`${stem(w)} ${stem(next)}`, `${w} ${next}`, b.id);
      }
    }
  }
  const n = Math.max(1, body.length);
  const scored = [...cands.entries()]
    .filter(([key, c]) => c.count >= (key.includes(' ') ? 2 : 3))
    .map(([key, c]) => {
      const spread = Math.log(1 + n / c.blocks.size);
      const lengthBonus = key.includes(' ') ? 1.4 : c.display.length >= 8 ? 1.2 : 1;
      return { key, c, score: c.count * spread * lengthBonus };
    })
    .sort((a, b) => b.score - a.score);

  const entries = new Map<string, GlossaryEntry>();
  for (const [term, d] of defs) {
    entries.set(term, { term, definition: d.definition, defined: true, blockId: d.blockId, occurrences: countMentions(blocks, term) });
  }
  for (const { c } of scored) {
    if (entries.size >= limit) break;
    if ([...entries.keys()].some((t) => t.includes(c.display) || c.display.includes(t))) continue;
    entries.set(c.display, {
      term: c.display,
      definition: firstSentenceWith(blocks, c.display) ?? '',
      defined: false,
      blockId: c.firstBlock,
      occurrences: c.count,
    });
  }
  return [...entries.values()].sort((a, b) => Number(b.defined) - Number(a.defined) || b.occurrences - a.occurrences);
}

// \b does not work for Devanagari, so Hindi terms are matched as plain substrings.
const termRe = (term: string, flags: string) => new RegExp(isHindi(term) ? escapeRe(term) : `\\b${escapeRe(term)}`, flags);

function countMentions(blocks: Block[], term: string): number {
  const re = termRe(term, 'gi');
  return blocks.reduce((s, b) => s + (b.text.match(re)?.length ?? 0), 0);
}

function firstSentenceWith(blocks: Block[], term: string): string | null {
  const re = termRe(term, 'i');
  for (const b of blocks) {
    if (b.type === 'heading') continue;
    for (const s of b.sentences) {
      const sentence = b.text.slice(s.start, s.end);
      if (re.test(sentence)) return sentence;
    }
  }
  return null;
}

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
