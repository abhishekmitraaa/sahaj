import type { Block } from '../types';
import { buildIndex, queryVector, scoreAll, type TfIdfIndex } from './tfidf';

export interface MatchResult {
  blockIndex: number;
  score: number;
}

/**
 * Follows a live lecture through a document. Each new caption is added to a
 * rolling window of recent speech; the window is compared to every paragraph.
 * Lectures mostly move forward, so paragraphs just after the current position
 * get a small boost, and a jump elsewhere needs clearly stronger evidence.
 */
export class LectureMatcher {
  private index: TfIdfIndex;
  private targets: number[];
  private window: string[] = [];
  current = -1;

  constructor(
    blocks: Block[],
    private windowWords = 30,
    private threshold = 0.16,
  ) {
    // Index paragraph-like blocks; headings are folded into the next paragraph
    // so "now let's talk about the stomata" can match a section by its title.
    this.targets = [];
    const texts: string[] = [];
    let pendingHeading = '';
    blocks.forEach((b, i) => {
      if (b.type === 'heading') {
        pendingHeading = b.text;
        return;
      }
      this.targets.push(i);
      texts.push(`${pendingHeading} ${pendingHeading} ${b.text}`);
      pendingHeading = '';
    });
    this.index = buildIndex(texts);
  }

  reset() {
    this.window = [];
    this.current = -1;
  }

  push(caption: string): MatchResult | null {
    this.window.push(...caption.split(/\s+/).filter(Boolean));
    if (this.window.length > this.windowWords) this.window = this.window.slice(-this.windowWords);
    // Weight the newest speech more: score the full window and the latest caption.
    const full = scoreAll(this.index, this.window.join(' '));
    const recent = scoreAll(this.index, caption);
    const recentTerms = [...queryVector(this.index, caption).keys()];
    const curT = this.targets.indexOf(this.current);

    let best = -1;
    let bestScore = 0;
    full.forEach((s, t) => {
      // A single shared word ("open your notebooks") is not evidence of a topic:
      // the latest caption must share at least two content words with the paragraph.
      const shared = recentTerms.filter((term) => this.index.vectors[t].has(term)).length;
      if (shared < 2 && t !== curT) return;
      let score = 0.5 * s + 0.5 * recent[t];
      if (curT >= 0) {
        // Staying put is only favoured while the teacher is still on the same topic.
        if (t === curT) score += shared > 0 ? 0.04 : -0.04;
        else if (t > curT && t <= curT + 3) score += 0.03;
        else score -= 0.02;
      }
      if (score > bestScore) [best, bestScore] = [t, score];
    });
    if (best < 0 || bestScore < this.threshold) return null;
    const blockIndex = this.targets[best];
    this.current = blockIndex;
    return { blockIndex, score: Math.min(1, bestScore) };
  }
}
