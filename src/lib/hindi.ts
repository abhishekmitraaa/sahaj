import { translateToHindi } from './chromeai';
import { useApp } from '../state/app';

const inflight = new Map<string, Promise<string>>();

/**
 * Hindi translation of a block, translated once on device and cached in app
 * state (which also makes it appear under the paragraph). Concurrent requests
 * for the same block share one translation.
 */
export function ensureHindi(block: { id: string; text: string }, onProgress?: (f: number) => void): Promise<string> {
  const cached = useApp.getState().translations[block.id];
  if (cached) return Promise.resolve(cached);
  let p = inflight.get(block.id);
  if (!p) {
    p = translateToHindi(block.text, onProgress)
      .then((hi) => {
        const app = useApp.getState();
        app.set({ translations: { ...app.translations, [block.id]: hi } });
        return hi;
      })
      .finally(() => inflight.delete(block.id));
    inflight.set(block.id, p);
  }
  return p;
}

/** Id of the rendered Hindi translation of a block (used for highlighting). */
export const hindiId = (blockId: string) => `${blockId}h`;
