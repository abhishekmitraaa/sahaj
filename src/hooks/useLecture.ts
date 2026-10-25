import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { Doc } from '../lib/types';
import { LectureMatcher } from '../lib/nlp/match';
import { summarize } from '../lib/nlp/summarize';
import { listen, type SttError } from '../lib/speech/stt';
import { scrollToBlock } from '../lib/highlight';
import { loadNotes, saveNotes, type Caption } from '../lib/storage';
import { sectionOf } from '../lib/view';
import { useApp } from '../state/app';
import { useSettings } from '../state/settings';
import { useT } from '../i18n';

const newId = () => Math.random().toString(36).slice(2, 10);

/** Live (microphone) or simulated lecture captions, matched to the open document. */
export function useLecture(doc: Doc | null) {
  const t = useT();
  const matcher = useMemo(() => (doc ? new LectureMatcher(doc.blocks) : null), [doc]);
  const stopRef = useRef<(() => void) | null>(null);
  const lastBlock = useRef<string | null>(null);

  // Load saved class notes for this document.
  useEffect(() => {
    if (!doc) return;
    let alive = true;
    loadNotes(doc.id).then((captions) => alive && useApp.getState().setLecture({ captions }));
    return () => {
      alive = false;
    };
  }, [doc]);

  const handleFinal = useCallback(
    (text: string) => {
      if (!doc || !matcher) return;
      const app = useApp.getState();
      const match = matcher.push(text);
      let blockId = lastBlock.current;
      if (match) {
        blockId = doc.blocks[match.blockIndex].id;
        lastBlock.current = blockId;
        app.setLecture({ match: match.blockIndex });
        if (useSettings.getState().followLecture) scrollToBlock(blockId);
      }
      const idx = blockId ? doc.blocks.findIndex((b) => b.id === blockId) : -1;
      const sec = idx >= 0 ? sectionOf(doc.blocks, idx) : -1;
      const caption: Caption = {
        id: newId(),
        t: Date.now() - app.lecture.startedAt,
        text,
        blockId,
        section: sec >= 0 ? doc.blocks[sec].text : null,
      };
      const captions = [...useApp.getState().lecture.captions, caption];
      app.setLecture({ captions, interim: '' });
      void saveNotes(doc.id, captions);
    },
    [doc, matcher],
  );

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
    useApp.getState().setLecture({ active: false, mode: null, interim: '' });
  }, []);

  const begin = useCallback(
    (mode: 'live' | 'sim') => {
      stop();
      matcher?.reset();
      lastBlock.current = null;
      const app = useApp.getState();
      const prevCaptions = app.lecture.captions;
      const offset = prevCaptions.length ? prevCaptions[prevCaptions.length - 1].t + 2000 : 0;
      app.setLecture({ active: true, mode, match: null, interim: '', local: null, startedAt: Date.now() - offset });
    },
    [matcher, stop],
  );

  const startLive = useCallback(() => {
    begin('live');
    const app = useApp.getState();
    stopRef.current = listen({
      lang: useSettings.getState().captionLang,
      continuous: true,
      onFinal: handleFinal,
      onInterim: (interim) => useApp.getState().setLecture({ interim }),
      onLocal: (local) => useApp.getState().setLecture({ local }),
      onError: (e: SttError) => {
        const msg = e === 'not-allowed' ? t('micBlocked') : e === 'network' ? t('networkError') : e === 'unsupported' ? t('sttUnsupported') : null;
        if (msg) {
          app.announce(msg);
          stop();
        }
      },
    });
  }, [begin, handleFinal, stop, t]);

  const startSim = useCallback(async () => {
    if (!doc) return;
    begin('sim');
    let script: { t: number; text: string }[] = [];
    if (doc.sourceType === 'sample' && doc.lang === 'en') {
      try {
        script = await (await fetch(`${import.meta.env.BASE_URL}samples/lecture-script.json`)).json();
      } catch {
        script = [];
      }
    }
    if (!script.length) {
      // Any other document: the "teacher" talks through its key sentences.
      script = summarize(doc.blocks, 0.35, 14).map((p, i) => ({ t: i * 6, text: p.text }));
    }
    let cancelled = false;
    const timers: number[] = [];
    stopRef.current = () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
    // Reveal each line word by word as interim text, then commit it, like live captions.
    let at = 600;
    for (const line of script) {
      const words = line.text.split(/\s+/);
      words.forEach((_, i) => {
        timers.push(window.setTimeout(() => !cancelled && useApp.getState().setLecture({ interim: words.slice(0, i + 1).join(' ') }), at + i * 230));
      });
      at += words.length * 230 + 250;
      timers.push(window.setTimeout(() => !cancelled && handleFinal(line.text), at));
      at += 900;
    }
    timers.push(window.setTimeout(() => !cancelled && stop(), at + 500));
  }, [begin, doc, handleFinal, stop]);

  const clearNotes = useCallback(() => {
    useApp.getState().setLecture({ captions: [] });
    if (doc) void saveNotes(doc.id, []);
  }, [doc]);

  useEffect(() => stop, [doc, stop]);

  return { startLive, startSim, stop, clearNotes };
}
