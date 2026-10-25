import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ViewBlock } from '../lib/view';
import { sectionOf } from '../lib/view';
import type { GlossaryEntry } from '../lib/nlp/glossary';
import { escapeRe } from '../lib/nlp/glossary';
import { loadVoices, voicesFor, ttsSupported } from '../lib/speech/tts';
import { sttSupported } from '../lib/speech/stt';
import type { Playback } from '../hooks/usePlayback';
import { useApp } from '../state/app';
import { useSettings } from '../state/settings';
import { useT } from '../i18n';
import { Icon } from './Icon';

/** Caption text with glossary terms turned into buttons that open their meaning. */
function linkTerms(text: string, terms: string[]): ReactNode {
  if (!terms.length) return text;
  // \b only works for Latin script; Devanagari terms match as plain substrings.
  const alt = terms.map((t) => (/[ऀ-ॿ]/.test(t) ? escapeRe(t) : `\\b${escapeRe(t)}\\b`)).join('|');
  const re = new RegExp(`(${alt})`, 'gi');
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index! > last) out.push(text.slice(last, m.index));
    const term = terms.find((t) => t === m[0].toLowerCase()) ?? m[0].toLowerCase();
    out.push(
      <button
        key={m.index}
        type="button"
        className="cap-term"
        onClick={() => {
          useSettings.getState().set({ panel: 'glossary' });
          useApp.getState().set({ glossaryFocus: null });
          requestAnimationFrame(() => useApp.getState().set({ glossaryFocus: term }));
        }}
      >
        {m[0]}
      </button>,
    );
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

interface CaptionProps {
  blocks: ViewBlock[];
  entries: GlossaryEntry[];
  onStop: () => void;
}

function CaptionStrip({ blocks, entries, onStop }: CaptionProps) {
  const t = useT();
  const lecture = useApp((s) => s.lecture);
  const s = useSettings();
  // Only underline words the document actually defines; everyday words would add noise.
  const terms = useMemo(() => entries.filter((e) => e.defined).map((e) => e.term).sort((a, b) => b.length - a.length), [entries]);
  const recent = lecture.captions.slice(-2);
  const matchHeading = lecture.match !== null ? sectionOf(blocks, lecture.match) : -1;
  return (
    <section className="captions" aria-label={t('lectureTitle')} style={{ '--cap': `${s.captionSize}px` } as React.CSSProperties}>
      <div className="captions-head">
        <span className="live-dot" aria-hidden="true" />
        <strong>{lecture.mode === 'sim' ? t('simulate') : t('lectureTitle')}</strong>
        {lecture.mode === 'live' && lecture.local !== null && <span>{lecture.local ? t('onDevice') : t('cloud')}</span>}
        <label className="toggle" style={{ padding: 0, gap: 8, gridTemplateColumns: 'auto auto' }}>
          <span className="toggle-text">{t('follow')}</span>
          <input type="checkbox" checked={s.followLecture} onChange={(e) => s.set({ followLecture: e.target.checked })} />
        </label>
        <span style={{ display: 'flex', gap: 4 }}>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => s.set({ captionSize: Math.max(18, s.captionSize - 4) })} aria-label={`${t('captionSize')} −`}>
            A−
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={() => s.set({ captionSize: Math.min(64, s.captionSize + 4) })} aria-label={`${t('captionSize')} +`}>
            A+
          </button>
        </span>
        {matchHeading >= 0 && (
          <span className="captions-match" aria-live="polite">
            {t('teacherHere')}: {blocks[matchHeading].text}
          </span>
        )}
        <button type="button" className="btn" onClick={onStop}>
          {t('stopLecture')}
        </button>
      </div>
      <div className="captions-text" aria-live="polite" aria-atomic="false">
        {!recent.length && !lecture.interim && <span className="interim">{t('waitingSpeech')}</span>}
        {recent.map((c, i) => (
          <span key={c.id} className={i < recent.length - 1 || lecture.interim ? 'old' : undefined}>
            {linkTerms(c.text, terms)}
          </span>
        ))}
        {lecture.interim && <span className="interim" aria-hidden="true">{lecture.interim}</span>}
      </div>
    </section>
  );
}

interface LectureMenuProps {
  onLive: () => void;
  onSim: () => void;
}

function LectureMenu({ onLive, onSim }: LectureMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const s = useSettings();
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);
  return (
    <div style={{ position: 'relative' }}>
      <button type="button" className="btn" aria-expanded={open} aria-controls="lecture-menu" onClick={() => setOpen(!open)}>
        <Icon name="captions" /> <span className="btn-label">{t('lecture')}</span>
      </button>
      {open && (
        <div
          id="lecture-menu"
          role="dialog"
          aria-label={t('lectureTitle')}
          style={{
            position: 'absolute', bottom: 'calc(100% + 10px)', right: 0, width: 'min(340px, calc(100vw - 24px))',
            background: 'var(--paper)', border: '1.5px solid var(--line)', borderRadius: 14, padding: 16,
            boxShadow: 'var(--shadow)', display: 'grid', gap: 12,
          }}
        >
          <strong>{t('lectureTitle')}</strong>
          <span className="muted" style={{ fontSize: '0.92rem' }}>{t('lectureLead')}</span>
          <label className="field">
            <span className="field-label">{t('captionLanguage')}</span>
            <select className="select" value={s.captionLang} onChange={(e) => s.set({ captionLang: e.target.value })}>
              <option value="en-IN">English (India)</option>
              <option value="en-US">English (US)</option>
              <option value="hi-IN">हिंदी</option>
            </select>
          </label>
          <button type="button" className="btn btn-primary" disabled={!sttSupported} onClick={() => { setOpen(false); onLive(); }}>
            <Icon name="mic" /> {t('startLive')}
          </button>
          {!sttSupported && <span className="muted" style={{ fontSize: '0.88rem' }}>{t('sttUnsupported')}</span>}
          <button type="button" className="btn" onClick={() => { setOpen(false); onSim(); }}>
            <Icon name="play" /> {t('simulate')}
          </button>
        </div>
      )}
    </div>
  );
}

interface DockProps {
  blocks: ViewBlock[];
  entries: GlossaryEntry[];
  playback: Playback;
  lecture: { startLive: () => void; startSim: () => void; stop: () => void };
  voice: { listening: boolean; heard: string; toggle: () => void };
  hindi: { on: boolean; available: boolean; toggle: () => void };
}

export function Dock({ blocks, entries, playback, lecture, voice, hindi }: DockProps) {
  const t = useT();
  const playing = useApp((s) => s.playing);
  const pos = useApp((s) => s.pos);
  const lectureActive = useApp((s) => s.lecture.active);
  const download = useApp((s) => s.hindiDownload);
  const s = useSettings();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    loadVoices().then(setVoices);
  }, []);
  const blockLang = blocks[pos.b]?.lang ?? 'en';
  // The voice list follows the language actually being spoken.
  const docLang = hindi.on && blockLang === 'en' ? 'hi' : blockLang;
  const hasEnglish = blocks.some((b) => b.lang === 'en');
  const langVoices = voicesFor(docLang, voices);
  const voiceKey = docLang === 'hi' ? 'voiceHi' : 'voiceEn';
  const sec = sectionOf(blocks, pos.b);

  return (
    <section className="dock" aria-label={`${t('play')}, ${t('lecture')}`}>
      {lectureActive && <CaptionStrip blocks={blocks} entries={entries} onStop={lecture.stop} />}
      <div className="player" role="toolbar" aria-label="Read aloud controls">
        <div className="player-main">
          <button type="button" className="btn btn-ghost btn-icon hide-mobile" onClick={playback.prevSection} aria-label={t('prevSection')} title={`${t('prevSection')} (P)`}>
            <Icon name="prevSection" />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={playback.prevSentence} aria-label={t('prevSentence')} title={`${t('prevSentence')} (←)`}>
            <Icon name="prev" />
          </button>
          <button
            type="button"
            className="play-btn"
            onClick={playback.toggle}
            aria-label={playing ? t('pause') : t('play')}
            title={`${playing ? t('pause') : t('play')} (Space / K)`}
            disabled={!ttsSupported}
          >
            <Icon name={playing ? 'pause' : 'play'} />
          </button>
          <button type="button" className="btn btn-ghost btn-icon" onClick={playback.nextSentence} aria-label={t('nextSentence')} title={`${t('nextSentence')} (→)`}>
            <Icon name="next" />
          </button>
          <button type="button" className="btn btn-ghost btn-icon hide-mobile" onClick={playback.nextSection} aria-label={t('nextSection')} title={`${t('nextSection')} (N)`}>
            <Icon name="nextSection" />
          </button>
        </div>
        <label className="player-speed">
          <span className="btn-label">{t('speed')}</span>
          <input type="range" min={0.5} max={2.5} step={0.1} value={s.rate} onChange={(e) => s.set({ rate: Number(e.target.value) })} aria-valuetext={`${s.rate.toFixed(1)}×`} />
          <output style={{ fontVariantNumeric: 'tabular-nums', minWidth: '3ch' }}>{s.rate.toFixed(1)}×</output>
        </label>
        <label className="sr-only" htmlFor="voice-select">{t('voice')}</label>
        <select
          id="voice-select"
          className="select hide-mobile"
          style={{ maxWidth: 200 }}
          value={(s[voiceKey] as string | null) ?? ''}
          onChange={(e) => s.set({ [voiceKey]: e.target.value || null })}
        >
          {!langVoices.length && <option value="">{t('noVoices')}</option>}
          {langVoices.length > 0 && <option value="">{t('voice')}: auto</option>}
          {langVoices.map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name.replace(/^(Microsoft|Google)\s+/, '')} ({v.lang})
            </option>
          ))}
        </select>
        <div className="player-where hide-mobile" aria-hidden="true">
          {sec >= 0 ? blocks[sec].text : ''}
        </div>
        <div className="player-extra">
          {hasEnglish && (
            <button
              type="button"
              className="btn"
              aria-pressed={hindi.on}
              onClick={hindi.toggle}
              disabled={!hindi.available}
              title={hindi.available ? `${t('listenHindi')} (H)` : t('hindiUnsupported')}
            >
              <span aria-hidden="true" style={{ fontFamily: 'Mukta, sans-serif', fontWeight: 700 }}>अ</span>
              <span className="btn-label">{t('listenHindi')}</span>
              {download !== null && (
                <span className="muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {t('downloading')} {Math.round(download * 100)}%
                </span>
              )}
            </button>
          )}
          <LectureMenu onLive={lecture.startLive} onSim={lecture.startSim} />
          <button
            type="button"
            className={`btn${voice.listening ? ' mic-on' : ''}`}
            onClick={voice.toggle}
            aria-pressed={voice.listening}
            title={`${t('voiceCommands')} (V)`}
            disabled={!sttSupported}
          >
            <Icon name="mic" /> <span className="btn-label">{voice.listening ? t('listening') : t('voiceCommands')}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
