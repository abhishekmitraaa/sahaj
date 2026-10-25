import type { Block } from './types';
import { readability, type Readability } from './nlp/readability';
import { simplify } from './nlp/simplify';
import { splitSentences } from './structure/segment';

export interface Change {
  start: number;
  end: number;
  was: string;
}

/** A block as displayed: possibly rewritten in plain language, with its difficulty. */
export interface ViewBlock extends Block {
  changes?: Change[];
  difficulty?: Readability;
}

export function makeViewBlocks(blocks: Block[], plain: boolean): ViewBlock[] {
  return blocks.map((b) => {
    const prose = b.type === 'para' || b.type === 'list';
    if (!prose) return b;
    if (!plain || b.lang !== 'en') return { ...b, difficulty: readability(b.text) };
    const r = simplify(b.text);
    if (!r.changes) return { ...b, difficulty: readability(b.text) };
    const changes: Change[] = [];
    let at = 0;
    for (const p of r.pieces) {
      if (p.was) changes.push({ start: at, end: at + p.text.length, was: p.was });
      at += p.text.length;
    }
    return { ...b, text: r.text, sentences: splitSentences(r.text), changes, difficulty: readability(r.text) };
  });
}

/** Index of the heading that owns block i (or -1). */
export function sectionOf(blocks: Block[], i: number): number {
  for (let k = Math.min(i, blocks.length - 1); k >= 0; k--) if (blocks[k].type === 'heading') return k;
  return -1;
}
