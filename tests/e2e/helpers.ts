import { expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __say: (text: string) => string | false;
    __failNextRecognition: string | null;
    __ttsLog: { text: string; lang: string; rate: number; voice?: string }[];
    __ttsNoBoundary: boolean;
  }
}

/**
 * Replaces the microphone with a scriptable fake. `window.__say(text)` delivers
 * a final transcript to the active recogniser, exactly as Chrome would.
 */
export async function fakeMicrophone(page: Page) {
  await page.addInitScript(() => {
    const recs: FakeRec[] = [];
    window.__failNextRecognition = null;
    class FakeRec {
      lang = '';
      continuous = false;
      interimResults = false;
      active = false;
      onresult: ((e: unknown) => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      constructor() {
        recs.push(this);
      }
      start() {
        if (window.__failNextRecognition) {
          const error = window.__failNextRecognition;
          window.__failNextRecognition = null;
          setTimeout(() => {
            this.onerror?.({ error });
            this.onend?.();
          }, 0);
          return;
        }
        this.active = true;
        setTimeout(() => this.onstart?.(), 0);
      }
      stop() {
        if (!this.active) return;
        this.active = false;
        setTimeout(() => this.onend?.(), 0);
      }
      abort() {
        this.stop();
      }
    }
    Object.assign(window, { SpeechRecognition: FakeRec, webkitSpeechRecognition: FakeRec });
    window.__say = (text: string) => {
      const r = [...recs].reverse().find((x) => x.active);
      if (!r) return false;
      const result = Object.assign([{ transcript: text }], { isFinal: true });
      r.onresult?.({ resultIndex: 0, results: [result] });
      if (!r.continuous) r.stop();
      return r.lang;
    };
  });
}

/**
 * Replaces speech synthesis with a deterministic engine that fires a `boundary`
 * event per word (or none, when `__ttsNoBoundary` is set) and logs every utterance.
 */
export async function fakeSpeech(page: Page, { boundary = true } = {}) {
  await page.addInitScript((withBoundary: boolean) => {
    window.__ttsLog = [];
    window.__ttsNoBoundary = !withBoundary;
    let timers: number[] = [];
    const voices = [
      { name: 'Fake English', lang: 'en-IN', voiceURI: 'fake-en', localService: true, default: true },
      { name: 'Fake Hindi', lang: 'hi-IN', voiceURI: 'fake-hi', localService: true, default: false },
    ];
    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      voice: { voiceURI: string } | null = null;
      onstart: (() => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((e: { error: string }) => void) | null = null;
      onboundary: ((e: { name: string; charIndex: number }) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    const synth = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => voices,
      addEventListener: () => {},
      removeEventListener: () => {},
      resume: () => {},
      pause: () => {},
      cancel() {
        timers.forEach(clearTimeout);
        timers = [];
        synth.speaking = false;
      },
      speak(u: FakeUtterance) {
        window.__ttsLog.push({ text: u.text, lang: u.lang, rate: u.rate, voice: u.voice?.voiceURI });
        synth.speaking = true;
        const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
        at(10, () => u.onstart?.());
        let t = 20;
        if (!window.__ttsNoBoundary) {
          for (const m of u.text.matchAll(/\S+/g)) {
            const idx = m.index!;
            at(t, () => u.onboundary?.({ name: 'word', charIndex: idx }));
            t += 60;
          }
        } else {
          t = (u.text.length / 14 / u.rate) * 1000;
        }
        at(t + 40, () => {
          synth.speaking = false;
          u.onend?.();
        });
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
    Object.assign(window, { SpeechSynthesisUtterance: FakeUtterance });
  }, boundary);
}

/** Open the app and get past onboarding with the given profile card. */
export async function start(page: Page, profile = 'Just reading') {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'How can Sahaj help you study?' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: new RegExp(`^${profile}`) }).click();
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await expect(dialog).toBeHidden();
}

export async function openSample(page: Page) {
  await page.getByRole('button', { name: 'Try the sample science chapter' }).click();
  await expect(page.locator('.paper h1')).toHaveText('Chapter 4: How Plants Make Their Food');
}

export async function openHindiSample(page: Page) {
  await page.getByRole('button', { name: 'Try the Hindi sample' }).click();
  await expect(page.locator('.paper h1')).toContainText('प्रकाश संश्लेषण');
}

/** Every word highlighted by read-aloud during a period of time, in order. */
export async function sampleHighlightedWords(page: Page, ms = 2500): Promise<string[]> {
  return page.evaluate(async (total) => {
    const seen: string[] = [];
    const record = () => {
      const w = document.querySelector('.w.is-word')?.textContent;
      if (w && seen[seen.length - 1] !== w) seen.push(w);
    };
    record();
    const obs = new MutationObserver(record);
    obs.observe(document.querySelector('.paper')!, { subtree: true, attributes: true, attributeFilter: ['class'] });
    await new Promise((r) => setTimeout(r, total));
    obs.disconnect();
    return seen;
  }, ms);
}

export async function axeViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ path: 'node_modules/axe-core/axe.min.js' });
  return page.evaluate(async () => {
    const axe = (window as unknown as { axe: { run: (d: Document) => Promise<{ violations: { id: string; impact: string; nodes: { target: string[] }[] }[] }> } }).axe;
    const r = await axe.run(document);
    return r.violations.map((v) => `${v.impact} ${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`);
  });
}

export interface History {
  here: string[];
  match: string[];
  words: string[];
}

/**
 * Records, from page load, every paragraph marked "Teacher is here", every
 * caption-match label and every highlighted word, so assertions don't depend on
 * catching a moment in time on a slow machine.
 */
export async function trackHistory(page: Page) {
  await page.addInitScript(() => {
    const h = { here: [] as string[], match: [] as string[], words: [] as string[] };
    (window as unknown as { __history: typeof h }).__history = h;
    const push = (arr: string[], v: string | null | undefined) => {
      if (v && arr[arr.length - 1] !== v) arr.push(v);
    };
    const record = () => {
      push(h.here, document.querySelector('.blk.is-here')?.id);
      push(h.match, document.querySelector('.captions-match')?.textContent);
      push(h.words, document.querySelector('.w.is-word')?.textContent);
    };
    new MutationObserver(record).observe(document, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
  });
}

export const history = (page: Page): Promise<History> =>
  page.evaluate(() => (window as unknown as { __history: History }).__history);

/**
 * Stand-in for Chrome's on-device Translator API. Each English sentence becomes one
 * Hindi sentence ("अनुवाद: N शब्द।"), so sentence counts stay comparable.
 */
export async function fakeTranslator(page: Page, availability: 'available' | 'unsupported' = 'available') {
  await page.addInitScript((avail: string) => {
    if (avail === 'unsupported') {
      Object.defineProperty(window, 'Translator', { value: undefined, configurable: true });
      return;
    }
    const translate = async (text: string) =>
      (text.match(/[^.!?]+[.!?]?/g) ?? [text])
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => `अनुवाद: ${s.split(/\s+/).length} शब्द।`)
        .join(' ');
    Object.defineProperty(window, 'Translator', {
      configurable: true,
      value: {
        availability: async () => 'available',
        create: async () => ({ translate }),
      },
    });
  }, availability);
}
