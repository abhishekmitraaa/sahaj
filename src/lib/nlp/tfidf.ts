import { terms } from './tokenize';

export type Vector = Map<string, number>;

export interface TfIdfIndex {
  idf: Map<string, number>;
  vectors: Vector[];
  norms: number[];
}

function termFreq(text: string): Map<string, number> {
  const tf = new Map<string, number>();
  for (const t of terms(text)) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

export function buildIndex(texts: string[]): TfIdfIndex {
  const tfs = texts.map(termFreq);
  const df = new Map<string, number>();
  for (const tf of tfs) for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const n = texts.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + n / d));
  const vectors = tfs.map((tf) => weigh(tf, idf));
  return { idf, vectors, norms: vectors.map(norm) };
}

function weigh(tf: Map<string, number>, idf: Map<string, number>): Vector {
  const v: Vector = new Map();
  for (const [t, f] of tf) {
    const w = idf.get(t);
    if (w) v.set(t, (1 + Math.log(f)) * w);
  }
  return v;
}

const norm = (v: Vector) => Math.sqrt([...v.values()].reduce((s, x) => s + x * x, 0)) || 1;

export function queryVector(index: TfIdfIndex, text: string): Vector {
  return weigh(termFreq(text), index.idf);
}

export function cosine(a: Vector, b: Vector, normB = norm(b)): number {
  let dot = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const [t, w] of small) {
    const o = big.get(t);
    if (o) dot += w * o;
  }
  return dot / (norm(a) * normB);
}

/** Similarity of a query to every indexed text. */
export function scoreAll(index: TfIdfIndex, text: string): number[] {
  const q = queryVector(index, text);
  if (q.size === 0) return index.vectors.map(() => 0);
  return index.vectors.map((v, i) => cosine(q, v, index.norms[i]));
}
