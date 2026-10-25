import type { Lang } from '../types';
import { words } from '../structure/segment';

export const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

let voiceCache: SpeechSynthesisVoice[] = [];

/** Voices load asynchronously in Chrome; resolve once they're available. */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!ttsSupported) return Promise.resolve([]);
  const now = speechSynthesis.getVoices();
  if (now.length) return Promise.resolve((voiceCache = now));
  return new Promise((resolve) => {
    const done = () => resolve((voiceCache = speechSynthesis.getVoices()));
    speechSynthesis.addEventListener('voiceschanged', done, { once: true });
    setTimeout(done, 1500);
  });
}

export function voicesFor(lang: Lang, all = voiceCache): SpeechSynthesisVoice[] {
  const prefix = lang === 'hi' ? 'hi' : 'en';
  return all.filter((v) => v.lang.toLowerCase().startsWith(prefix));
}

/** Best default voice: Indian English / Hindi first, natural-sounding voices preferred. */
export function pickVoice(lang: Lang, preferredUri?: string | null): SpeechSynthesisVoice | null {
  const list = voicesFor(lang);
  if (preferredUri) {
    const chosen = list.find((v) => v.voiceURI === preferredUri);
    if (chosen) return chosen;
  }
  const score = (v: SpeechSynthesisVoice) =>
    (v.lang.toLowerCase().endsWith('-in') ? 4 : 0) +
    (/natural|neural|online/i.test(v.name) ? 3 : 0) +
    (/google/i.test(v.name) ? 2 : 0) +
    (v.localService ? 1 : 0);
  return [...list].sort((a, b) => score(b) - score(a))[0] ?? null;
}

export interface SpeakOptions {
  text: string;
  lang: Lang;
  rate: number;
  voice: SpeechSynthesisVoice | null;
  /** Character range of the word currently being spoken. */
  onWord?: (start: number, end: number) => void;
  onEnd?: () => void;
}

/**
 * Speaks one utterance at a time with word callbacks. Chrome's network voices
 * never fire `boundary` events, so if none arrive shortly after speech starts
 * we drive the highlight from an estimated timeline instead.
 */
class Speaker {
  private generation = 0;
  private timers: number[] = [];
  private current: SpeechSynthesisUtterance | null = null;

  speak(o: SpeakOptions) {
    this.cancel();
    const gen = ++this.generation;
    const u = new SpeechSynthesisUtterance(o.text);
    u.lang = o.voice?.lang ?? (o.lang === 'hi' ? 'hi-IN' : 'en-IN');
    if (o.voice) u.voice = o.voice;
    u.rate = o.rate;
    const tokens = words(o.text);
    let sawBoundary = false;

    u.onboundary = (e) => {
      if (gen !== this.generation || e.name === 'sentence') return;
      if (!sawBoundary) {
        sawBoundary = true;
        this.clearTimers();
      }
      const t = tokens.find((w) => w.end > e.charIndex);
      if (t) o.onWord?.(t.start, t.end);
    };
    u.onstart = () => {
      if (gen !== this.generation) return;
      if (tokens[0]) o.onWord?.(tokens[0].start, tokens[0].end);
      this.timers.push(window.setTimeout(() => {
        if (!sawBoundary && gen === this.generation) this.estimate(tokens, o, gen);
      }, 350));
    };
    const finish = () => {
      if (gen !== this.generation) return;
      this.clearTimers();
      this.current = null;
      o.onEnd?.();
    };
    u.onend = finish;
    u.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      finish();
    };
    this.current = u; // keep a reference: Chrome can garbage-collect utterances mid-speech
    speechSynthesis.resume();
    speechSynthesis.speak(u);
  }

  private estimate(tokens: ReturnType<typeof words>, o: SpeakOptions, gen: number) {
    // ~14 characters per second at rate 1 for English, a little slower for Hindi.
    const cps = (o.lang === 'hi' ? 12 : 14) * o.rate;
    const startedAt = 350;
    tokens.forEach((t, i) => {
      if (i === 0) return;
      const pauses = (o.text.slice(0, t.start).match(/[,;:]/g)?.length ?? 0) * 180;
      const at = (t.start / cps) * 1000 + pauses / o.rate - startedAt;
      this.timers.push(window.setTimeout(() => gen === this.generation && o.onWord?.(t.start, t.end), Math.max(0, at)));
    });
  }

  private clearTimers() {
    this.timers.forEach(clearTimeout);
    this.timers = [];
  }

  cancel() {
    this.generation++;
    this.clearTimers();
    this.current = null;
    if (ttsSupported) speechSynthesis.cancel();
  }

  get speaking() {
    return this.current !== null;
  }
}

export const speaker = new Speaker();

/** Speak a short message (announcements, glossary definitions) without callbacks. */
export function say(text: string, lang: Lang, rate: number, voiceUri?: string | null, onEnd?: () => void) {
  if (!ttsSupported) return;
  speaker.speak({ text, lang, rate, voice: pickVoice(lang, voiceUri), onEnd });
}
