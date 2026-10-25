import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Lang, Span } from '../lib/types';
import type { ViewBlock } from '../lib/view';
import { useApp } from '../state/app';
import { useSettings } from '../state/settings';
import { pickVoice, speaker, ttsSupported } from '../lib/speech/tts';
import { clearHighlight, highlightSentence, highlightWord } from '../lib/highlight';
import { ensureHindi, hindiId } from '../lib/hindi';
import { splitSentences } from '../lib/structure/segment';
import { savePosition } from '../lib/storage';

export interface Playback {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  nextSentence: () => void;
  prevSentence: () => void;
  nextSection: () => void;
  prevSection: () => void;
  playFrom: (b: number, s?: number) => void;
  goTo: (b: number) => void;
  /** Switch between reading the original and reading a Hindi translation, optionally starting at a block. */
  setListenHindi: (on: boolean, from?: { b: number; s?: number }) => void;
}

/** What is actually spoken for a block: its own text, or its Hindi translation. */
interface Unit {
  id: string;
  text: string;
  sentences: Span[];
  lang: Lang;
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

/** Sentence-by-sentence read-aloud over the displayed blocks, with word highlighting. */
export function usePlayback(blocks: ViewBlock[], docId: string | undefined): Playback {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;
  // Bumped on every new speak request so a slow translation can't speak over a newer one.
  const runRef = useRef(0);
  // Set when a language switch already restarted speech, so the settings effect doesn't do it again.
  const languageHandled = useRef(false);
  const applyHindi = (on: boolean) => {
    if (useSettings.getState().listenHindi === on) return;
    languageHandled.current = true;
    useSettings.getState().set({ listenHindi: on });
  };

  const wantsHindi = (b: ViewBlock) => useSettings.getState().listenHindi && b.lang === 'en';

  const unitOf = useCallback((b: number): Unit | null => {
    const block = blocksRef.current[b];
    if (!block) return null;
    if (wantsHindi(block)) {
      const hi = useApp.getState().translations[block.id];
      if (hi) return { id: hindiId(block.id), text: hi, sentences: splitSentences(hi), lang: 'hi' };
    }
    return { id: block.id, text: block.text, sentences: block.sentences, lang: block.lang };
  }, []);

  const clamp = useCallback(
    (b: number, s: number) => {
      const bl = blocksRef.current;
      b = Math.max(0, Math.min(b, bl.length - 1));
      s = Math.max(0, Math.min(s, (unitOf(b)?.sentences.length ?? 1) - 1));
      return { b, s };
    },
    [unitOf],
  );

  const mark = useCallback(
    (b: number, s: number, scroll = true) => {
      const unit = unitOf(b);
      if (!unit) return;
      useApp.getState().set({ pos: { b, s } });
      highlightSentence(unit.id, s, scroll && useSettings.getState().autoScroll);
    },
    [unitOf],
  );

  const speakAt = useCallback(
    async (b: number, s: number) => {
      const run = ++runRef.current;
      const bl = blocksRef.current;
      const app = useApp.getState();
      // Skip blocks with nothing to say.
      while (b < bl.length && !bl[b].sentences.length) {
        b++;
        s = 0;
      }
      if (b >= bl.length) {
        app.set({ playing: false });
        clearHighlight();
        app.announce('End of document');
        return;
      }

      const block = bl[b];
      if (wantsHindi(block)) {
        const fresh = !app.translations[block.id];
        try {
          await ensureHindi(block);
          if (fresh) await nextFrame(); // let the translation render before highlighting it
        } catch {
          applyHindi(false);
          app.announce('Hindi translation is not available in this browser, so reading continues in the original language.');
        }
        if (run !== runRef.current || !useApp.getState().playing) return;
        // Translate the next couple of blocks ahead so the voice never waits.
        for (const next of bl.slice(b + 1, b + 3)) if (wantsHindi(next)) ensureHindi(next).catch(() => {});
      }

      const unit = unitOf(b)!;
      if (s >= unit.sentences.length) {
        speakAt(b + 1, 0);
        return;
      }
      const sent = unit.sentences[s];
      mark(b, s);
      const { rate, voiceEn, voiceHi } = useSettings.getState();
      speaker.speak({
        text: unit.text.slice(sent.start, sent.end),
        lang: unit.lang,
        rate,
        voice: pickVoice(unit.lang, unit.lang === 'hi' ? voiceHi : voiceEn),
        onWord: (start) => highlightWord(unit.id, sent.start + start),
        onEnd: () => {
          if (useApp.getState().playing && run === runRef.current) speakAt(b, s + 1);
        },
      });
    },
    [mark, unitOf],
  );

  const play = useCallback(() => {
    if (!ttsSupported || !blocksRef.current.length) return;
    const { pos } = useApp.getState();
    const { b, s } = clamp(pos.b, pos.s);
    useApp.getState().set({ playing: true });
    speakAt(b, s);
  }, [clamp, speakAt]);

  const pause = useCallback(() => {
    runRef.current++;
    useApp.getState().set({ playing: false });
    speaker.cancel();
  }, []);

  const jump = useCallback(
    (b: number, s: number) => {
      const p = clamp(b, s);
      if (useApp.getState().playing) speakAt(p.b, p.s);
      else mark(p.b, p.s);
    },
    [clamp, mark, speakAt],
  );

  const nextSentence = useCallback(() => {
    const { pos } = useApp.getState();
    const unit = unitOf(pos.b);
    if (unit && pos.s + 1 < unit.sentences.length) jump(pos.b, pos.s + 1);
    else jump(pos.b + 1, 0);
  }, [jump, unitOf]);

  const prevSentence = useCallback(() => {
    const { pos } = useApp.getState();
    if (pos.s > 0) jump(pos.b, pos.s - 1);
    else if (pos.b > 0) jump(pos.b - 1, (unitOf(pos.b - 1)?.sentences.length ?? 1) - 1);
  }, [jump, unitOf]);

  const headingIndexes = useMemo(() => blocks.map((b, i) => (b.type === 'heading' ? i : -1)).filter((i) => i >= 0), [blocks]);

  const nextSection = useCallback(() => {
    const { pos } = useApp.getState();
    const h = headingIndexes.find((i) => i > pos.b);
    if (h !== undefined) jump(h, 0);
  }, [headingIndexes, jump]);

  const prevSection = useCallback(() => {
    const { pos } = useApp.getState();
    const before = headingIndexes.filter((i) => i < pos.b);
    // If we're already a few sentences into a section, go to its start first.
    const own = headingIndexes.filter((i) => i <= pos.b).pop();
    const target = own !== undefined && own < pos.b ? own : before.pop();
    if (target !== undefined) jump(target, 0);
  }, [headingIndexes, jump]);

  const playFrom = useCallback(
    (b: number, s = 0) => {
      const p = clamp(b, s);
      useApp.getState().set({ playing: true });
      speakAt(p.b, p.s);
    },
    [clamp, speakAt],
  );

  const goTo = useCallback((b: number) => jump(b, 0), [jump]);

  const toggle = useCallback(() => (useApp.getState().playing ? pause() : play()), [pause, play]);

  const setListenHindi = useCallback(
    (on: boolean, from?: { b: number; s?: number }) => {
      applyHindi(on);
      if (from) playFrom(from.b, from.s ?? 0);
      else if (useApp.getState().playing) {
        // Sentence numbers differ between languages, so restart the current paragraph.
        playFrom(useApp.getState().pos.b, 0);
      }
    },
    [playFrom],
  );

  // Restart the current sentence when speed, voice, language or the displayed text changes.
  const rate = useSettings((s) => s.rate);
  const voiceEn = useSettings((s) => s.voiceEn);
  const voiceHi = useSettings((s) => s.voiceHi);
  const listenHindi = useSettings((s) => s.listenHindi);
  const lastHindi = useRef(listenHindi);
  useEffect(() => {
    const { playing, pos } = useApp.getState();
    const switchedLanguage = lastHindi.current !== listenHindi;
    lastHindi.current = listenHindi;
    if (switchedLanguage && languageHandled.current) {
      languageHandled.current = false;
      return;
    }
    if (!playing) return;
    // Sentence numbers differ between English and Hindi, so a language switch restarts the paragraph.
    const p = switchedLanguage ? { b: pos.b, s: 0 } : clamp(pos.b, pos.s);
    speakAt(p.b, p.s);
  }, [rate, voiceEn, voiceHi, listenHindi, blocks, clamp, speakAt]);

  // Remember where the student stopped.
  const pos = useApp((s) => s.pos);
  useEffect(() => {
    if (!docId) return;
    const t = setTimeout(() => savePosition(docId, pos), 600);
    return () => clearTimeout(t);
  }, [docId, pos]);

  useEffect(() => () => speaker.cancel(), []);

  // One stable object, so memoised children (every paragraph) don't re-render on each App render.
  return useMemo(
    () => ({ play, pause, toggle, nextSentence, prevSentence, nextSection, prevSection, playFrom, goTo, setListenHindi }),
    [play, pause, toggle, nextSentence, prevSentence, nextSection, prevSection, playFrom, goTo, setListenHindi],
  );
}
