import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { ViewBlock } from '../lib/view';
import { useApp } from '../state/app';
import { useSettings } from '../state/settings';
import { pickVoice, speaker, ttsSupported } from '../lib/speech/tts';
import { clearHighlight, highlightSentence, highlightWord } from '../lib/highlight';
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
}

/** Sentence-by-sentence read-aloud over the displayed blocks, with word highlighting. */
export function usePlayback(blocks: ViewBlock[], docId: string | undefined): Playback {
  const blocksRef = useRef(blocks);
  blocksRef.current = blocks;

  const clamp = useCallback((b: number, s: number) => {
    const bl = blocksRef.current;
    b = Math.max(0, Math.min(b, bl.length - 1));
    s = Math.max(0, Math.min(s, (bl[b]?.sentences.length ?? 1) - 1));
    return { b, s };
  }, []);

  const mark = useCallback((b: number, s: number, scroll = true) => {
    const block = blocksRef.current[b];
    if (!block) return;
    useApp.getState().set({ pos: { b, s } });
    highlightSentence(block.id, s, scroll && useSettings.getState().autoScroll);
  }, []);

  const speakAt = useCallback(
    (b: number, s: number) => {
      const bl = blocksRef.current;
      // Skip blocks with nothing to say.
      while (b < bl.length && (!bl[b].sentences.length || s >= bl[b].sentences.length)) {
        b++;
        s = 0;
      }
      const app = useApp.getState();
      if (b >= bl.length) {
        app.set({ playing: false });
        clearHighlight();
        app.announce('End of document');
        return;
      }
      const block = bl[b];
      const sent = block.sentences[s];
      mark(b, s);
      const { rate, voiceEn, voiceHi } = useSettings.getState();
      speaker.speak({
        text: block.text.slice(sent.start, sent.end),
        lang: block.lang,
        rate,
        voice: pickVoice(block.lang, block.lang === 'hi' ? voiceHi : voiceEn),
        onWord: (start) => highlightWord(block.id, sent.start + start),
        onEnd: () => {
          if (useApp.getState().playing) speakAt(b, s + 1);
        },
      });
    },
    [mark],
  );

  const play = useCallback(() => {
    if (!ttsSupported || !blocksRef.current.length) return;
    const { pos } = useApp.getState();
    const { b, s } = clamp(pos.b, pos.s);
    useApp.getState().set({ playing: true });
    speakAt(b, s);
  }, [clamp, speakAt]);

  const pause = useCallback(() => {
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
    const block = blocksRef.current[pos.b];
    if (block && pos.s + 1 < block.sentences.length) jump(pos.b, pos.s + 1);
    else jump(pos.b + 1, 0);
  }, [jump]);

  const prevSentence = useCallback(() => {
    const { pos } = useApp.getState();
    if (pos.s > 0) jump(pos.b, pos.s - 1);
    else if (pos.b > 0) jump(pos.b - 1, (blocksRef.current[pos.b - 1]?.sentences.length ?? 1) - 1);
  }, [jump]);

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

  // Restart the current sentence when speed, voice or the displayed text changes.
  const rate = useSettings((s) => s.rate);
  const voiceEn = useSettings((s) => s.voiceEn);
  const voiceHi = useSettings((s) => s.voiceHi);
  useEffect(() => {
    const { playing, pos } = useApp.getState();
    if (!playing) return;
    const p = clamp(pos.b, pos.s);
    speakAt(p.b, p.s);
  }, [rate, voiceEn, voiceHi, blocks, clamp, speakAt]);

  // Remember where the student stopped.
  const pos = useApp((s) => s.pos);
  useEffect(() => {
    if (!docId) return;
    const t = setTimeout(() => savePosition(docId, pos), 600);
    return () => clearTimeout(t);
  }, [docId, pos]);

  useEffect(() => () => speaker.cancel(), []);

  return { play, pause, toggle, nextSentence, prevSentence, nextSection, prevSection, playFrom, goTo };
}
