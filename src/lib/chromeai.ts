// Chrome's built-in, on-device AI (Translator and Summarizer APIs). These run
// locally once the model is downloaded; no API keys and no document upload.
// Everything here is optional: callers fall back to Sahaj's own offline tools.

type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'unsupported';

interface Monitor {
  addEventListener(type: 'downloadprogress', cb: (e: { loaded: number }) => void): void;
}
interface TranslatorLike {
  translate(text: string): Promise<string>;
}
interface SummarizerLike {
  summarize(text: string, o?: { context?: string }): Promise<string>;
}
interface AiGlobal {
  Translator?: {
    availability(o: { sourceLanguage: string; targetLanguage: string }): Promise<Availability>;
    create(o: { sourceLanguage: string; targetLanguage: string; monitor?: (m: Monitor) => void }): Promise<TranslatorLike>;
  };
  Summarizer?: {
    availability(): Promise<Availability>;
    create(o: { type: string; format: string; length: string; monitor?: (m: Monitor) => void }): Promise<SummarizerLike>;
  };
}

const ai = (typeof self !== 'undefined' ? self : {}) as unknown as AiGlobal;

export async function translatorAvailability(): Promise<Availability> {
  if (!ai.Translator) return 'unsupported';
  try {
    return await ai.Translator.availability({ sourceLanguage: 'en', targetLanguage: 'hi' });
  } catch {
    return 'unavailable';
  }
}

let translator: Promise<TranslatorLike> | null = null;

/** Translate English → Hindi on device. Must first be called from a click (model download). */
export async function translateToHindi(text: string, onProgress?: (f: number) => void): Promise<string> {
  if (!ai.Translator) throw new Error('unsupported');
  translator ??= ai.Translator.create({
    sourceLanguage: 'en',
    targetLanguage: 'hi',
    monitor: (m) => m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)),
  });
  try {
    return await (await translator).translate(text);
  } catch (e) {
    translator = null;
    throw e;
  }
}

export async function summarizerAvailability(): Promise<Availability> {
  if (!ai.Summarizer) return 'unsupported';
  try {
    return await ai.Summarizer.availability();
  } catch {
    return 'unavailable';
  }
}

let summarizer: Promise<SummarizerLike> | null = null;

export async function aiKeyPoints(text: string, onProgress?: (f: number) => void): Promise<string[]> {
  if (!ai.Summarizer) throw new Error('unsupported');
  summarizer ??= ai.Summarizer.create({
    type: 'key-points',
    format: 'plain-text',
    length: 'short',
    monitor: (m) => m.addEventListener('downloadprogress', (e) => onProgress?.(e.loaded)),
  });
  try {
    const out = await (await summarizer).summarize(text, { context: 'A school textbook section for a student.' });
    return out.split('\n').map((l) => l.replace(/^[\s*•\-\d.]+/, '').trim()).filter(Boolean);
  } catch (e) {
    summarizer = null;
    throw e;
  }
}
