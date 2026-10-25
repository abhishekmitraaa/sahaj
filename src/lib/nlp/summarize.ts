import type { Block } from '../types';
import { terms } from './tokenize';

export interface Section {
  heading: string;
  headingId?: string;
  blocks: Block[];
}

export function sections(blocks: Block[]): Section[] {
  const out: Section[] = [];
  let cur: Section = { heading: '', blocks: [] };
  for (const b of blocks) {
    if (b.type === 'heading') {
      if (cur.blocks.length || cur.heading) out.push(cur);
      cur = { heading: b.text, headingId: b.id, blocks: [] };
    } else cur.blocks.push(b);
  }
  if (cur.blocks.length || cur.heading) out.push(cur);
  return out.filter((s) => s.blocks.length);
}

export interface KeyPoint {
  text: string;
  blockId: string;
}

/**
 * Extractive summary with TextRank: sentences that share vocabulary with many
 * other sentences are the most central. Returns sentences in reading order.
 */
export function summarize(blocks: Block[], ratio = 0.3, max = 4): KeyPoint[] {
  const sents: KeyPoint[] = [];
  for (const b of blocks) {
    if (b.type === 'heading') continue;
    for (const s of b.sentences) {
      const text = b.text.slice(s.start, s.end);
      if (text.split(/\s+/).length >= 5) sents.push({ text, blockId: b.id });
    }
  }
  if (sents.length <= 2) return sents;
  const bags = sents.map((s) => new Set(terms(s.text)));
  const n = sents.length;
  const sim: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let overlap = 0;
      for (const t of bags[i]) if (bags[j].has(t)) overlap++;
      const denom = Math.log(bags[i].size + 1) + Math.log(bags[j].size + 1);
      sim[i][j] = sim[j][i] = denom > 0 ? overlap / denom : 0;
    }
  }
  let rank = new Array(n).fill(1 / n);
  const outSum = sim.map((row) => row.reduce((a, b) => a + b, 0) || 1);
  for (let iter = 0; iter < 30; iter++) {
    rank = rank.map((_, i) => 0.15 / n + 0.85 * sim[i].reduce((acc, w, j) => acc + (w * rank[j]) / outSum[j], 0));
  }
  // Slight lead bias: the first sentence of a section usually frames it.
  rank[0] *= 1.15;
  const k = Math.min(max, Math.max(1, Math.ceil(n * ratio)));
  const top = rank.map((r, i) => [r, i] as const).sort((a, b) => b[0] - a[0]).slice(0, k).map(([, i]) => i);
  return top.sort((a, b) => a - b).map((i) => sents[i]);
}
