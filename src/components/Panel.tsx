import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Doc } from '../lib/types';
import { buildGlossary, type GlossaryEntry } from '../lib/nlp/glossary';
import { sections, summarize } from '../lib/nlp/summarize';
import { aiKeyPoints, summarizerAvailability } from '../lib/chromeai';
import { scrollToBlock } from '../lib/highlight';
import { say } from '../lib/speech/tts';
import type { Caption } from '../lib/storage';
import glossaryHi from '../data/glossary-hi.json';
import { useApp } from '../state/app';
import { useSettings, type Panel as PanelId } from '../state/settings';
import { useT, type StringKey } from '../i18n';
import { Icon } from './Icon';

const HI = glossaryHi as Record<string, string>;
const TABS: PanelId[] = ['glossary', 'summary', 'notes', 'report'];

export function hindiFor(term: string): string | undefined {
  const t = term.toLowerCase();
  return HI[t] ?? HI[t.replace(/s$/, '')] ?? HI[t.split(' ').pop() ?? ''];
}

export function useGlossary(doc: Doc) {
  return useMemo(() => buildGlossary(doc.blocks), [doc]);
}

function speak(text: string) {
  const s = useSettings.getState();
  const lang = /[ऀ-ॿ]/.test(text) ? 'hi' : 'en';
  say(text, lang, s.rate, lang === 'hi' ? s.voiceHi : s.voiceEn);
}

function Glossary({ entries }: { entries: GlossaryEntry[] }) {
  const t = useT();
  const focus = useApp((s) => s.glossaryFocus);
  const [q, setQ] = useState('');
  const shown = entries.filter((e) => !q || e.term.includes(q.toLowerCase()) || e.definition.toLowerCase().includes(q.toLowerCase()));
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    if (!focus) return;
    setQ('');
    const el = listRef.current?.querySelector<HTMLElement>(`[data-term="${CSS.escape(focus)}"]`);
    el?.scrollIntoView({ block: 'nearest' });
    el?.focus();
  }, [focus]);
  return (
    <>
      <p className="panel-lead">{t('glossaryLead')}</p>
      <label className="sr-only" htmlFor="gloss-search">{t('searchWords')}</label>
      <input id="gloss-search" className="text-input" type="search" placeholder={t('searchWords')} value={q} onChange={(e) => setQ(e.target.value)} style={{ width: '100%', marginBottom: 12 }} />
      {!shown.length && <p className="muted">{t('noGlossary')}</p>}
      <ul className="gloss" ref={listRef}>
        {shown.map((e) => {
          const hi = hindiFor(e.term);
          return (
            <li key={e.term} data-term={e.term} tabIndex={-1} className={focus === e.term ? 'is-focus' : undefined}>
              <div className="gloss-term">
                <span>{e.term}</span>
                {hi && <span className="gloss-hi" lang="hi">{hi}</span>}
              </div>
              {e.definition && <p className="gloss-def">{e.definition}</p>}
              <div className="gloss-meta">
                <span>
                  {e.occurrences} {t('mentions')}
                </span>
                <button type="button" className="btn btn-ghost" onClick={() => speak(`${e.term}. ${e.definition}`)}>
                  <Icon name="speaker" /> {t('listen')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => scrollToBlock(e.blockId)}>
                  {t('showInText')}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Summary({ doc }: { doc: Doc }) {
  const t = useT();
  const secs = useMemo(() => sections(doc.blocks).map((s) => ({ ...s, points: summarize(s.blocks, 0.3, 3) })), [doc]);
  const [aiState, setAiState] = useState<'unknown' | 'ready' | 'none'>('unknown');
  const [aiPoints, setAiPoints] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    summarizerAvailability().then((a) => setAiState(a === 'available' || a === 'downloadable' || a === 'downloading' ? 'ready' : 'none'));
  }, []);
  const runAi = async () => {
    setBusy(true);
    try {
      const out: Record<string, string[]> = {};
      for (const s of secs) {
        out[s.heading || 'intro'] = await aiKeyPoints(s.blocks.map((b) => b.text).join('\n'));
        setAiPoints({ ...out });
      }
    } catch {
      useApp.getState().announce('On-device AI is not available right now. The summary below still works offline.');
    }
    setBusy(false);
  };
  const all = secs.flatMap((s) => [s.heading, ...(aiPoints[s.heading || 'intro'] ?? s.points.map((p) => p.text))]).filter(Boolean).join('. ');
  return (
    <>
      <p className="panel-lead">{t('summaryLead')}</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="btn" onClick={() => speak(all)}>
          <Icon name="speaker" /> {t('listenSummary')}
        </button>
        {aiState === 'ready' && doc.lang === 'en' && (
          <button type="button" className="btn" onClick={runAi} disabled={busy}>
            <Icon name="sparkle" /> {busy ? t('working') : t('aiShorter')}
          </button>
        )}
      </div>
      {secs.map((s) => {
        const ai = aiPoints[s.heading || 'intro'];
        return (
          <section key={s.headingId ?? 'intro'} lang={doc.lang}>
            {s.heading && (
              <h3>
                <a href={`#blk-${s.headingId}`} onClick={(e) => { e.preventDefault(); if (s.headingId) scrollToBlock(s.headingId); }} style={{ color: 'inherit' }}>
                  {s.heading}
                </a>
              </h3>
            )}
            <ul className="points">
              {ai ? ai.map((p, i) => <li key={i}>{p}</li>) : s.points.map((p, i) => <li key={i}>{p.text}</li>)}
            </ul>
          </section>
        );
      })}
    </>
  );
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export function notesToMarkdown(title: string, captions: Caption[]): string {
  const lines = [`# Class notes: ${title}`, '', `Saved from Sahaj on ${new Date().toLocaleString()}`, ''];
  let section: string | null | undefined;
  for (const c of captions) {
    if (c.section !== section) {
      section = c.section;
      lines.push('', `## ${section ?? 'General'}`, '');
    }
    lines.push(`- [${fmt(c.t)}] ${c.text}`);
  }
  return lines.join('\n');
}

function Notes({ doc, onClear }: { doc: Doc; onClear: () => void }) {
  const t = useT();
  const captions = useApp((s) => s.lecture.captions);
  const groups: { section: string | null; blockId: string | null; items: Caption[] }[] = [];
  for (const c of captions) {
    const g = groups[groups.length - 1];
    if (g && g.section === c.section) g.items.push(c);
    else groups.push({ section: c.section, blockId: c.blockId, items: [c] });
  }
  const download = () => {
    const blob = new Blob([notesToMarkdown(doc.title, captions)], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${doc.title.replace(/[^\wऀ-ॿ]+/g, '-').slice(0, 40)}-notes.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const endRef = useRef<HTMLDivElement>(null);
  // Braces matter: Chrome's scrollIntoView now returns a Promise, which React would treat as a cleanup.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [captions.length]);
  if (!captions.length) return <p className="panel-lead">{t('notesEmpty')}</p>;
  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button type="button" className="btn" onClick={download}>
          <Icon name="download" /> {t('exportNotes')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onClear}>
          {t('clearNotes')}
        </button>
      </div>
      {groups.map((g, i) => (
        <section key={i} className="notes-group">
          <h3>
            {g.blockId ? (
              <a href={`#blk-${g.blockId}`} onClick={(e) => { e.preventDefault(); scrollToBlock(g.blockId!); }} style={{ color: 'inherit' }}>
                {g.section ?? 'General'}
              </a>
            ) : (
              g.section ?? 'General'
            )}
          </h3>
          {g.items.map((c) => (
            <div key={c.id} className="note">
              <time>{fmt(c.t)}</time>
              <span>{c.text}</span>
            </div>
          ))}
        </section>
      ))}
      <div ref={endRef} />
    </>
  );
}

function Report({ doc }: { doc: Doc }) {
  const t = useT();
  const r = doc.report;
  const rows: [number, StringKey][] = [
    [r.headersRemoved, 'headers'],
    [r.footersRemoved, 'footers'],
    [r.pageNumbersRemoved, 'pageNumbers'],
    [r.hyphenFixes, 'hyphens'],
    [r.columnPages, 'columns'],
    [r.ocrPages, 'ocr'],
    [r.headingsFound, 'headings'],
    [r.figuresFound, 'figures'],
  ];
  return (
    <>
      <p className="panel-lead">{t('reportLead')}</p>
      <ul className="stats">
        {rows.map(([n, key]) => (
          <li key={key} className={n ? undefined : 'zero'}>
            <span className="num">{n}</span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
      <h3>{doc.title}</h3>
      <ul className="stats">
        <li>
          <span className="num">{r.words}</span>
          <span>{t('words')}</span>
        </li>
        <li>
          <span className="num">{r.listenMinutes}</span>
          <span>
            {t('listenTime')} ({t('minutes')})
          </span>
        </li>
        <li>
          <span className="num">{Math.round(r.readingGrade)}</span>
          <span>{t('readingLevel')} ({t('grade')})</span>
        </li>
      </ul>
      {doc.raw.length > 0 && (
        <button type="button" className="btn" style={{ marginTop: 16 }} onClick={() => useApp.getState().set({ compare: true })}>
          <Icon name="compare" /> {t('seeCompare')}
        </button>
      )}
    </>
  );
}

export function Panel({ doc, entries, onClearNotes }: { doc: Doc; entries: GlossaryEntry[]; onClearNotes: () => void }) {
  const t = useT();
  const panel = useSettings((s) => s.panel);
  const set = useSettings((s) => s.set);
  if (!panel) return <aside className="panel" aria-hidden="true" />;
  const onKey = (e: KeyboardEvent) => {
    const i = TABS.indexOf(panel);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      set({ panel: next });
      requestAnimationFrame(() => document.getElementById(`tab-${next}`)?.focus());
    }
  };
  return (
    <aside className="panel" aria-label={t(panel)}>
      <div className="tabs">
        <div role="tablist" aria-label={t('studyTools')} onKeyDown={onKey} style={{ display: 'flex', gap: 2 }}>
        {TABS.map((id) => (
          <button
            key={id}
            id={`tab-${id}`}
            role="tab"
            type="button"
            className="tab"
            aria-selected={panel === id}
            aria-controls="panel-body"
            tabIndex={panel === id ? 0 : -1}
            onClick={() => set({ panel: id })}
          >
            {t(`tab_${id}` as StringKey)}
            {id === 'notes' && <NotesCount />}
          </button>
        ))}
        </div>
        <button type="button" className="btn btn-ghost btn-icon tab-close" onClick={() => set({ panel: null })} aria-label={t('closePanel')}>
          <Icon name="close" />
        </button>
      </div>
      <div className="panel-body" id="panel-body" role="tabpanel" aria-labelledby={`tab-${panel}`} tabIndex={0}>
        {panel === 'glossary' && <Glossary entries={entries} />}
        {panel === 'summary' && <Summary doc={doc} />}
        {panel === 'notes' && <Notes doc={doc} onClear={onClearNotes} />}
        {panel === 'report' && <Report doc={doc} />}
      </div>
    </aside>
  );
}

function NotesCount() {
  const n = useApp((s) => s.lecture.captions.length);
  return n ? <span className="muted"> ({n})</span> : null;
}
