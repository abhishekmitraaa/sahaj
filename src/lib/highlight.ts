// Read-aloud highlighting is done directly on the DOM so that a word change
// (several per second) never re-renders the React tree.

let currentWord: Element | null = null;
let currentSentence: Element | null = null;

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const wordId = (blockId: string, offset: number) => `w-${blockId}-${offset}`;
export const sentenceId = (blockId: string, index: number) => `s-${blockId}-${index}`;
export const blockDomId = (blockId: string) => `blk-${blockId}`;

export function clearHighlight() {
  currentWord?.classList.remove('is-word');
  currentSentence?.classList.remove('is-reading');
  currentWord = currentSentence = null;
}

/** Scroll an element into the comfortable middle band of its scroll container if needed. */
export function revealElement(el: Element, force = false) {
  const scroller = el.closest('.reading-scroll');
  if (!scroller) return;
  const r = el.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();
  const comfortable = r.top > s.top + s.height * 0.15 && r.bottom < s.top + s.height * 0.75;
  if (force || !comfortable) el.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
}

export function highlightSentence(blockId: string, index: number, scroll: boolean) {
  currentSentence?.classList.remove('is-reading');
  currentWord?.classList.remove('is-word');
  currentWord = null;
  currentSentence = document.getElementById(sentenceId(blockId, index));
  currentSentence?.classList.add('is-reading');
  if (scroll && currentSentence) revealElement(currentSentence);
}

export function highlightWord(blockId: string, offset: number) {
  const el = document.getElementById(wordId(blockId, offset));
  if (!el || el === currentWord) return;
  currentWord?.classList.remove('is-word');
  el.classList.add('is-word');
  currentWord = el;
  window.dispatchEvent(new CustomEvent('sahaj:word', { detail: el.getBoundingClientRect() }));
}

export function scrollToBlock(blockId: string) {
  const el = document.getElementById(blockDomId(blockId));
  if (el) revealElement(el, true);
}
