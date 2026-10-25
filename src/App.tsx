import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Doc } from './lib/types';
import type { Command } from './lib/speech/commands';
import { makeViewBlocks, sectionOf } from './lib/view';
import { loadPosition, saveDoc } from './lib/storage';
import { clearHighlight, scrollToBlock } from './lib/highlight';
import { say, speaker } from './lib/speech/tts';
import { translateToHindi, translatorAvailability } from './lib/chromeai';
import { usePlayback } from './hooks/usePlayback';
import { useLecture } from './hooks/useLecture';
import { useVoiceCommands } from './hooks/useVoiceCommands';
import { useApp } from './state/app';
import { PROFILES, useSettings, type ProfileId } from './state/settings';
import { PROFILE_TEXT, useT } from './i18n';
import { Home } from './components/Home';
import { Reader } from './components/Reader';
import { Toc } from './components/Toc';
import { Panel, hindiFor, useGlossary } from './components/Panel';
import { Dock } from './components/Dock';
import { CompareView } from './components/CompareView';
import { DisplayDrawer, HelpDialog, Onboarding, Toast, useStatusToast } from './components/Dialogs';
import { Icon } from './components/Icon';
import { ErrorBoundary } from './components/ErrorBoundary';

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="var(--ink)" />
      <rect x="10" y="30" width="44" height="12" rx="3" fill="#ffe45c" />
      <path d="M14 22h36M14 48h28" stroke="var(--paper)" strokeOpacity=".6" strokeWidth="3" strokeLinecap="round" />
      <path d="M20 36h24" stroke="#1b2a4a" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export default function App() {
  const t = useT();
  const s = useSettings();
  const doc = useApp((a) => a.doc);
  const compare = useApp((a) => a.compare);
  const displayOpen = useApp((a) => a.displayOpen);
  const helpOpen = useApp((a) => a.helpOpen);
  const status = useApp((a) => a.status);
  const setApp = useApp((a) => a.set);
  const announce = useApp((a) => a.announce);
  const [tocOpen, setTocOpen] = useState(false);
  const [canTranslate, setCanTranslate] = useState(false);
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const toast = useStatusToast();
  const small = useMediaQuery('(max-width: 1100px)');
  // On small screens the side panel is a bottom sheet: closed until asked for.
  const [sheetOpen, setSheetOpen] = useState(false);
  // Open it when something asks for a panel (a command, a caption term), but not
  // when a profile switch merely changes the default panel.
  const lastPanel = useRef({ panel: s.panel, profile: s.profile });
  useEffect(() => {
    const prev = lastPanel.current;
    lastPanel.current = { panel: s.panel, profile: s.profile };
    if (prev.profile !== s.profile || prev.panel === s.panel) return;
    setSheetOpen(!!s.panel);
  }, [s.panel, s.profile]);

  const blocks = useMemo(() => (doc ? makeViewBlocks(doc.blocks, s.plain) : []), [doc, s.plain]);
  const playback = usePlayback(blocks, doc?.id);
  const lecture = useLecture(doc);
  const entries = useGlossary(doc ?? EMPTY_DOC);

  // Theme + language on <html> so every surface (and the browser UI) follows.
  useEffect(() => {
    document.documentElement.dataset.theme = s.theme;
    document.documentElement.lang = s.uiLang;
  }, [s.theme, s.uiLang]);

  useEffect(() => {
    translatorAvailability().then((a) => setCanTranslate(a !== 'unsupported' && a !== 'unavailable'));
  }, []);

  // Spoken confirmation for blind / low-vision profiles, in addition to the live region.
  useEffect(() => {
    if (!status.text || !s.speakFeedback || useApp.getState().playing) return;
    say(status.text, /[ऀ-ॿ]/.test(status.text) ? 'hi' : 'en', s.rate, null);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDoc = useCallback(
    async (d: Doc, isNew: boolean) => {
      speaker.cancel();
      clearHighlight();
      if (isNew) void saveDoc(d);
      const pos = (!isNew && (await loadPosition(d.id))) || { b: 0, s: 0 };
      setApp({ doc: d, pos, playing: false, compare: false, translations: {} });
      useApp.getState().setLecture({ captions: [], match: null, active: false, interim: '' });
      announce(`${d.title}. ${d.report.words} ${t('words')}.`);
      requestAnimationFrame(() => document.getElementById('main')?.focus());
    },
    [announce, setApp, t],
  );

  const goHome = () => {
    speaker.cancel();
    lecture.stop();
    setApp({ doc: null, playing: false, compare: false });
  };

  const translate = useCallback(
    async (index: number) => {
      const b = blocks[index];
      if (!b) return;
      setTranslatingId(b.id);
      try {
        const hi = await translateToHindi(b.text);
        setApp({ translations: { ...useApp.getState().translations, [b.id]: hi } });
      } catch {
        announce('Hindi translation needs Chrome’s built-in translator, which is not available here.');
      }
      setTranslatingId(null);
    },
    [announce, blocks, setApp],
  );

  const onRead = useCallback((index: number, sentence = 0) => playback.playFrom(index, sentence), [playback]);

  const findBlock = (query: string) => {
    const q = query.toLowerCase();
    const heading = blocks.findIndex((b) => b.type === 'heading' && b.text.toLowerCase().includes(q));
    return heading >= 0 ? heading : blocks.findIndex((b) => b.text.toLowerCase().includes(q));
  };

  const define = (term: string) => {
    const q = term.toLowerCase();
    const e = entries.find((x) => x.term === q) ?? entries.find((x) => x.term.includes(q) || q.includes(x.term)) ??
      entries.find((x) => hindiFor(x.term)?.includes(term));
    if (!e) {
      announce(`“${term}” is not in this document’s key words.`);
      return;
    }
    s.set({ panel: 'glossary' });
    setApp({ glossaryFocus: e.term });
    const hi = hindiFor(e.term);
    const text = `${e.term}${hi ? ` (${hi})` : ''}. ${e.definition}`;
    announce(text);
    if (!s.speakFeedback) say(text, 'en', s.rate, s.voiceEn);
  };

  const runCommand = (c: Command, heard: string) => {
    const done = (msg: string) => announce(`${t('heard')}: “${heard}”. ${msg}`);
    switch (c.type) {
      case 'play': playback.play(); break;
      case 'pause': playback.pause(); done(t('pause')); break;
      case 'faster': s.set({ rate: Math.min(2.5, +(s.rate + 0.2).toFixed(1)) }); done(`${t('speed')} ${Math.min(2.5, s.rate + 0.2).toFixed(1)}`); break;
      case 'slower': s.set({ rate: Math.max(0.5, +(s.rate - 0.2).toFixed(1)) }); done(`${t('speed')} ${Math.max(0.5, s.rate - 0.2).toFixed(1)}`); break;
      case 'next': playback.nextSentence(); break;
      case 'previous': playback.prevSentence(); break;
      case 'nextSection': playback.nextSection(); break;
      case 'prevSection': playback.prevSection(); break;
      case 'top': playback.goTo(0); break;
      case 'bigger': s.set({ fontSize: Math.min(56, s.fontSize + 4) }); done(t('textSize')); break;
      case 'smaller': s.set({ fontSize: Math.max(14, s.fontSize - 4) }); done(t('textSize')); break;
      case 'theme': {
        const theme = c.theme === 'dark' ? 'night' : c.theme === 'light' ? 'paper' : c.theme;
        s.set({ theme });
        done(t(theme));
        break;
      }
      case 'ruler': s.set({ ruler: !s.ruler }); done(t('ruler')); break;
      case 'simplify': s.set({ plain: !s.plain }); done(t('plain')); break;
      case 'summary': s.set({ panel: 'summary' }); done(t('summary')); break;
      case 'glossary': s.set({ panel: 'glossary' }); done(t('glossary')); break;
      case 'notes': s.set({ panel: 'notes' }); done(t('notes')); break;
      case 'translate': translate(useApp.getState().pos.b); break;
      case 'lectureStart': lecture.startLive(); break;
      case 'lectureStop': lecture.stop(); break;
      case 'help': setApp({ helpOpen: true }); break;
      case 'whereAmI': {
        const sec = sectionOf(blocks, useApp.getState().pos.b);
        announce(sec >= 0 ? blocks[sec].text : doc?.title ?? '');
        break;
      }
      case 'goto': {
        const i = findBlock(c.query);
        if (i >= 0) {
          playback.goTo(i);
          scrollToBlock(blocks[i].id);
          done(blocks[i].type === 'heading' ? blocks[i].text : c.query);
        } else announce(`“${c.query}” was not found in this document.`);
        break;
      }
      case 'define': define(c.term); break;
    }
  };
  const voice = useVoiceCommands(runCommand);

  // Keyboard shortcuts (ignored while typing in a field or when a dialog is open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target instanceof Element ? e.target : document.body;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (el.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      if (!doc || compare) {
        if (e.key === '?') setApp({ helpOpen: true });
        return;
      }
      const onControl = el.closest('button, a, [role="tab"]');
      const k = e.key.toLowerCase();
      const act = (fn: () => void) => {
        e.preventDefault();
        fn();
      };
      if (k === ' ' && !onControl) act(playback.toggle);
      else if (k === 'k') act(playback.toggle);
      else if (e.key === 'ArrowRight' && !el.closest('[role="tablist"]')) act(playback.nextSentence);
      else if (e.key === 'ArrowLeft' && !el.closest('[role="tablist"]')) act(playback.prevSentence);
      else if (e.key === 'ArrowUp' && !onControl) act(() => s.set({ rate: Math.min(2.5, +(s.rate + 0.1).toFixed(1)) }));
      else if (e.key === 'ArrowDown' && !onControl) act(() => s.set({ rate: Math.max(0.5, +(s.rate - 0.1).toFixed(1)) }));
      else if (k === 'n') act(playback.nextSection);
      else if (k === 'p') act(playback.prevSection);
      else if (k === 'r') act(() => { s.set({ ruler: !s.ruler }); announce(`${t('ruler')}: ${!s.ruler ? 'on' : 'off'}`); });
      else if (k === 's') act(() => { s.set({ plain: !s.plain }); announce(`${t('plain')}: ${!s.plain ? 'on' : 'off'}`); });
      else if (k === 'l') act(() => (useApp.getState().lecture.active ? lecture.stop() : lecture.startSim()));
      else if (k === 'v') act(voice.toggle);
      else if (k === 'd') act(() => setApp({ displayOpen: true }));
      else if (e.key === '+' || e.key === '=') act(() => s.set({ fontSize: Math.min(56, s.fontSize + 2) }));
      else if (e.key === '-') act(() => s.set({ fontSize: Math.max(14, s.fontSize - 2) }));
      else if (e.key === '?') act(() => setApp({ helpOpen: true }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const focus = s.focusMode;
  const showToc = s.showToc && !focus;
  const showPanel = !!s.panel && !focus && (!small || sheetOpen);

  return (
    <div className={`app${focus ? ' is-focus' : ''}`}>
      <a className="skip-link" href="#main">{t('skip')}</a>
      <header className="topbar">
        <button type="button" className="brand" onClick={goHome}>
          <BrandMark />
          <span>Sahaj</span>
          <span className="brand-hi" lang="hi">सहज</span>
          <span className="sr-only">, {t('home')}</span>
        </button>
        {doc && <span className="doc-title" lang={doc.lang}>{doc.title}</span>}
        <div className="topbar-actions">
          {doc && (
            <>
              <button type="button" className="btn btn-ghost hide-in-focus hide-mobile" onClick={goHome}>
                <Icon name="book" /> <span className="btn-label">{t('home')}</span>
              </button>
              <button type="button" className="btn btn-ghost btn-icon toc-toggle hide-in-focus" aria-pressed={tocOpen || s.showToc} onClick={() => { setTocOpen(!tocOpen); s.set({ showToc: !s.showToc }); }} aria-label={s.showToc ? t('hideContents') : t('showContents')} title={t('contents')}>
                <Icon name="list" />
              </button>
              <button type="button" className="btn btn-ghost hide-in-focus" aria-pressed={compare} onClick={() => setApp({ compare: !compare })}>
                <Icon name="compare" /> <span className="btn-label">{t('compare')}</span>
              </button>
            </>
          )}
          <label className="sr-only" htmlFor="profile-select">{t('profile')}</label>
          <select id="profile-select" className="select hide-in-focus hide-mobile" value={s.profile} onChange={(e) => { s.applyProfile(e.target.value as ProfileId); announce(PROFILE_TEXT[e.target.value][s.uiLang][0]); }}>
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>{PROFILE_TEXT[p.id][s.uiLang][0]}</option>
            ))}
          </select>
          <button type="button" className="btn" onClick={() => setApp({ displayOpen: true })} title={`${t('display')} (D)`}>
            <Icon name="type" /> <span className="btn-label">{t('display')}</span>
          </button>
          {focus && (
            <button type="button" className="btn" onClick={() => s.set({ focusMode: false })}>
              <Icon name="focus" /> <span className="btn-label">{t('focusMode')}</span>
            </button>
          )}
          <button type="button" className="btn btn-ghost hide-in-focus" onClick={() => s.set({ uiLang: s.uiLang === 'hi' ? 'en' : 'hi' })} lang={s.uiLang === 'hi' ? 'en' : 'hi'}>
            <Icon name="lang" /> <span className="btn-label">{t('language')}</span>
          </button>
          <button type="button" className="btn btn-ghost btn-icon hide-in-focus" onClick={() => setApp({ helpOpen: true })} aria-label={t('help')} title={`${t('help')} (?)`}>
            <Icon name="help" />
          </button>
          {doc && !showPanel && !focus && (
            <button type="button" className="btn btn-ghost" onClick={() => { s.set({ panel: s.panel ?? 'glossary' }); setSheetOpen(true); }}>
              <Icon name="sparkle" /> <span className="btn-label">{t('glossary')}</span>
            </button>
          )}
        </div>
      </header>

      {!doc && <Home onOpen={openDoc} />}
      {doc && compare && <CompareView doc={doc} />}
      {doc && !compare && (
        <div className={`workspace${showToc ? '' : ' no-toc'}${showPanel ? '' : ' no-panel'}${tocOpen ? ' toc-open' : ''}`}>
          <Toc blocks={blocks} onGo={(i) => { playback.goTo(i); scrollToBlock(blocks[i].id); setTocOpen(false); }} />
          <main className="reading-scroll" id="main" tabIndex={-1}>
            <ErrorBoundary fallback={(retry) => <Recover onRetry={retry} />}>
              <Reader blocks={blocks} onRead={onRead} onTranslate={translate} canTranslate={canTranslate} translatingId={translatingId} />
            </ErrorBoundary>
          </main>
          {showPanel ? (
            <ErrorBoundary fallback={(retry) => <aside className="panel"><Recover onRetry={retry} /></aside>}>
              <Panel doc={doc} entries={entries} onClearNotes={lecture.clearNotes} />
            </ErrorBoundary>
          ) : (
            <aside className="panel" aria-hidden="true" />
          )}
        </div>
      )}
      {doc && !compare && <Dock blocks={blocks} entries={entries} playback={playback} lecture={lecture} voice={voice} />}

      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status.text}
      </div>
      {voice.listening && <Toast>{t('listening')} {voice.heard && `“${voice.heard}”`}</Toast>}
      {!voice.listening && toast && <Toast>{toast}</Toast>}

      {!s.onboarded && <Onboarding onDone={() => s.set({ onboarded: true })} />}
      {displayOpen && <DisplayDrawer onClose={() => setApp({ displayOpen: false })} />}
      {helpOpen && <HelpDialog onClose={() => setApp({ helpOpen: false })} />}
    </div>
  );
}

function Recover({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="error" role="alert" style={{ margin: 24, width: 'auto' }}>
      <strong>This part of the screen hit a problem.</strong>
      Your document and notes are safe.{' '}
      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={onRetry}>Show it again</button>
    </div>
  );
}

function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatch(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return match;
}

const EMPTY_DOC: Doc = {
  id: '', title: '', sourceName: '', sourceType: 'paste', createdAt: 0, lang: 'en', blocks: [], raw: [],
  report: {
    pages: 0, headersRemoved: 0, footersRemoved: 0, pageNumbersRemoved: 0, hyphenFixes: 0, linesMerged: 0,
    columnPages: 0, ocrPages: 0, headingsFound: 0, figuresFound: 0, words: 0, readingGrade: 0, listenMinutes: 0,
  },
};
