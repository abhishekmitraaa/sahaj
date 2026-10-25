import { detectLang, splitSentences, words } from '../structure/segment';
import { countSyllables } from './syllables';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Readability {
  /** Approximate school grade needed to read comfortably. */
  grade: number;
  difficulty: Difficulty;
  words: number;
  sentences: number;
  avgSentenceLength: number;
}

export function readability(text: string): Readability {
  const ws = words(text);
  const sentences = Math.max(1, splitSentences(text).length);
  const n = ws.length;
  if (n === 0) return { grade: 0, difficulty: 'easy', words: 0, sentences: 0, avgSentenceLength: 0 };
  const avg = n / sentences;
  let grade: number;
  if (detectLang(text) === 'hi') {
    // Syllable heuristics don't apply to Devanagari; sentence and word length
    // are the most reliable offline signals.
    const avgChars = ws.reduce((s, w) => s + [...w.word].length, 0) / n;
    grade = 0.4 * avg + 1.5 * avgChars - 4;
  } else {
    const syll = ws.reduce((s, w) => s + countSyllables(w.word), 0);
    grade = 0.39 * avg + 11.8 * (syll / n) - 15.59; // Flesch–Kincaid grade level
  }
  grade = Math.max(1, Math.round(grade * 10) / 10);
  const difficulty: Difficulty = grade <= 7 ? 'easy' : grade <= 11 ? 'medium' : 'hard';
  return { grade, difficulty, words: n, sentences, avgSentenceLength: Math.round(avg * 10) / 10 };
}

/** Minutes to listen at a comfortable 150 words per minute. */
export function listenMinutes(wordCount: number, wpm = 150): number {
  return Math.max(1, Math.round(wordCount / wpm));
}
