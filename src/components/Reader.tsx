import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ViewBlock } from '../lib/view';
import { splitSentences, words } from '../lib/structure/segment';
import { splitSyllables } from '../lib/nlp/syllables';
import { blockDomId, sentenceId, wordId } from '../lib/highlight';
import { hindiId } from '../lib/hindi';
import { useSettings, type FontChoice } from '../state/settings';
import { useApp } from '../state/app';
import { useT, type StringKey } from '../i18n';
import { Icon } from './Icon';

const FONTS: Record<FontChoice, string> = {
  atkinson: "'Atkinson Hyperlegible', 'Mukta', system-ui, sans-serif",
  lexend: "'Lexend', 'Mukta', system-ui, sans-serif",
  opendyslexic: "'OpenDyslexic', 'Mukta', system-ui, sans-serif",
  serif: "Georgia, 'Times New Roman', 'Mukta', serif",
};

interface WordOpts {
  bionic: boolean;
  syllables: boolean;
}

function renderWord(word: string, o: WordOpts, hindi: boolean): ReactNode {
  if (hindi) return word;
  if (o.syllables) {
    const parts = splitSyllables(word);
    if (parts.length > 1) {
      return parts.flatMap((p, i) => (i === 0 ? [p] : [<span key={i} className="syl" aria-hidden="true">·</span>, p]));
    }
  }
  if (o.bionic && word.length > 1) {
    const n = word.length <= 3 ? 1 : Math.ceil(word.length * 0.45);
    return (
      <>
        <b>{word.slice(0, n)}</b>
        {word.slice(n)}
      </>
    );
  }
  return word;
}

/** Block text split into sentence spans and word spans (for karaoke highlighting). */
function BlockText({ block, opts }: { block: ViewBlock; opts: WordOpts }) {
  const out: ReactNode[] = [];
  let cursor = 0;
  const hindi = block.lang === 'hi';
  block.sentences.forEach((sent, si) => {
    if (sent.start > cursor) out.push(block.text.slice(cursor, sent.start));
    const parts: ReactNode[] = [];
    let at = sent.start;
    for (const w of words(block.text.slice(sent.start, sent.end))) {
      const start = sent.start + w.start;
      const end = sent.start + w.end;
      if (start > at) parts.push(block.text.slice(at, start));
      const change = block.changes?.find((c) => start >= c.start && start < c.end);
      parts.push(
        <span
          key={start}
          id={wordId(block.id, start)}
          className={change ? 'w was-plain' : 'w'}
          title={change ? `Original: ${change.was}` : undefined}
        >
          {renderWord(w.word, opts, hindi)}
        </span>,
      );
      at = end;
    }
    if (sent.end > at) parts.push(block.text.slice(at, sent.end));
    out.push(
      <span key={`s${si}`} id={sentenceId(block.id, si)} className="sent">
        {parts}
      </span>,
    );
    cursor = sent.end;
  });
  if (cursor < block.text.length) out.push(block.text.slice(cursor));
  return <>{out}</>;
}

const DIFF_ICON = { easy: '●', medium: '◆', hard: '▲' } as const;

interface BlockProps {
  block: ViewBlock;
  index: number;
  opts: WordOpts;
  heatmap: boolean;
  isHere: boolean;
  translation?: string;
  canTranslate: boolean;
  onRead: (index: number) => void;
  onTranslate: (index: number) => void;
}

const BlockView = memo(function BlockView(p: BlockProps) {
  const t = useT();
  const { block } = p;
  const prose = block.type === 'para' || block.type === 'list';
  const cls = ['blk', block.type === 'heading' ? `blk-h${block.level ?? 2}` : `blk-${block.type}`, p.isHere ? 'is-here' : '']
    .filter(Boolean)
    .join(' ');
  const common = {
    id: blockDomId(block.id),
    className: cls,
    lang: block.lang,
    'aria-current': p.isHere ? ('location' as const) : undefined,
  };
  const body = <BlockText block={block} opts={p.opts} />;
  const extras = (
    <>
      {p.heatmap && prose && block.difficulty && (
        <span className="margin-mark">
          <span className={`diff diff-${block.difficulty.difficulty}`}>
            <span aria-hidden="true">{DIFF_ICON[block.difficulty.difficulty]}</span>
            <span className="diff-label" aria-hidden="true">{t(block.difficulty.difficulty as StringKey)}</span>
            <span className="sr-only">
              {t('readingLevel')}: {t(block.difficulty.difficulty as StringKey)}, {t('grade')} {Math.round(block.difficulty.grade)}
            </span>
          </span>
        </span>
      )}
      {p.isHere && <span className="here-tag">{t('teacherHere')}</span>}
      {prose && (
        <span className="blk-tools">
          <button type="button" className="tool-btn" onClick={() => p.onRead(p.index)} aria-label={t('readFromHere')} title={t('readFromHere')}>
            <Icon name="play" />
          </button>
          {p.canTranslate && block.lang === 'en' && (
            <button type="button" className="tool-btn" onClick={() => p.onTranslate(p.index)} aria-label={`${t('readInHindi')}: ${block.text.slice(0, 40)}`} title={t('readInHindi')}>
              अ
            </button>
          )}
        </span>
      )}
    </>
  );

  let el: ReactNode;
  if (block.type === 'heading') {
    const H = (`h${Math.min(3, block.level ?? 2)}` as 'h1' | 'h2' | 'h3');
    el = <H {...common} tabIndex={-1}>{body}</H>;
  } else if (block.type === 'figure') {
    el = (
      <figure {...common}>
        <figcaption>{body}</figcaption>
        {extras}
      </figure>
    );
  } else if (block.type === 'list') {
    el = (
      <li {...common}>
        {body}
        {extras}
      </li>
    );
  } else {
    el = (
      <p {...common}>
        {body}
        {extras}
      </p>
    );
  }
  return (
    <>
      {el}
      {p.translation && <Translation block={block} text={p.translation} opts={p.opts} />}
    </>
  );
});

/** The Hindi translation of a block, split into sentence and word spans so read-aloud can highlight it. */
function Translation({ block, text, opts }: { block: ViewBlock; text: string; opts: WordOpts }) {
  const hi: ViewBlock = { id: hindiId(block.id), type: 'para', text, lang: 'hi', sentences: splitSentences(text) };
  const body = <BlockText block={hi} opts={opts} />;
  return block.type === 'list' ? (
    <li className="translation" lang="hi" style={{ listStyle: 'none' }}>{body}</li>
  ) : (
    <p className="translation" lang="hi">{body}</p>
  );
}

function Ruler({ lead }: { lead: number }) {
  const [top, setTop] = useState<number | null>(null);
  useEffect(() => {
    const scroller = document.querySelector('.reading-scroll');
    const onMove = (e: Event) => {
      const me = e as MouseEvent;
      setTop(me.clientY - lead / 2 - 4);
    };
    const onWord = (e: Event) => {
      const r = (e as CustomEvent<DOMRect>).detail;
      setTop(r.top + r.height / 2 - lead / 2 - 4);
    };
    scroller?.addEventListener('mousemove', onMove);
    window.addEventListener('sahaj:word', onWord);
    return () => {
      scroller?.removeEventListener('mousemove', onMove);
      window.removeEventListener('sahaj:word', onWord);
    };
  }, [lead]);
  if (top === null) return null;
  // Confine the band (and its dimming) to the reading column.
  const r = document.querySelector('.reading-scroll')?.getBoundingClientRect();
  const height = lead + 8;
  const clipPath = r ? `inset(${Math.min(0, r.top - top)}px 0 ${Math.min(0, top + height - r.bottom)}px 0)` : undefined;
  const style = { top, height, left: r?.left ?? 0, width: r?.width ?? '100%', clipPath };
  return <div className="ruler" style={style} aria-hidden="true" />;
}

interface ReaderProps {
  blocks: ViewBlock[];
  onRead: (index: number, sentence?: number, hindi?: boolean) => void;
  onTranslate: (index: number) => void;
  canTranslate: boolean;
}

export function Reader({ blocks, onRead, onTranslate, canTranslate }: ReaderProps) {
  const s = useSettings();
  const match = useApp((a) => a.lecture.match);
  const lectureActive = useApp((a) => a.lecture.active || a.lecture.captions.length > 0);
  const translations = useApp((a) => a.translations);
  const ref = useRef<HTMLElement>(null);
  const opts = { bionic: s.bionic, syllables: s.syllables };
  // Stable object for memoised blocks.
  const optsKey = `${s.bionic}|${s.syllables}`;
  const stableOpts = useStableOpts(optsKey, opts);

  const onClick = useCallback(
    (e: React.MouseEvent) => {
      const w = (e.target as HTMLElement).closest('.w');
      if (!w || window.getSelection()?.toString()) return;
      const m = w.id.match(/^w-(.+)-(\d+)$/);
      if (!m) return;
      const offset = Number(m[2]);
      // A word in a Hindi translation ("b12h") reads that translation from its sentence.
      const hindi = m[1].endsWith('h') && !blocks.some((b) => b.id === m[1]);
      const blockId = hindi ? m[1].slice(0, -1) : m[1];
      const bi = blocks.findIndex((b) => b.id === blockId);
      if (bi < 0) return;
      const sentences = hindi ? splitSentences(useApp.getState().translations[blockId] ?? '') : blocks[bi].sentences;
      const si = sentences.findIndex((x) => offset >= x.start && offset < x.end);
      onRead(bi, Math.max(0, si), hindi);
    },
    [blocks, onRead],
  );

  const style = {
    '--fs': `${s.fontSize}px`,
    '--lh': s.lineHeight,
    '--ls': `${s.letterSpacing}em`,
    '--ws': `${s.wordSpacing}em`,
    '--measure': s.measure,
    '--reader-font': FONTS[s.font],
  } as React.CSSProperties;

  // Group consecutive list items into one <ul>.
  const items: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = (key: string) => {
    if (list.length) items.push(<ul key={`ul-${key}`} style={{ listStyle: 'none', margin: 0, padding: 0 }}>{list}</ul>);
    list = [];
  };
  blocks.forEach((b, i) => {
    const node = (
      <BlockView
        key={b.id}
        block={b}
        index={i}
        opts={stableOpts}
        heatmap={s.heatmap}
        isHere={lectureActive && match === i}
        translation={translations[b.id]}
        canTranslate={canTranslate}
        onRead={onRead}
        onTranslate={onTranslate}
      />
    );
    if (b.type === 'list') list.push(node);
    else {
      flush(b.id);
      items.push(node);
    }
  });
  flush('end');

  return (
    <>
      <article
        ref={ref}
        className={`paper${blocks[0]?.lang === 'hi' ? ' lang-hi' : ''}`}
        style={style}
        onClick={onClick}
        aria-label="Document"
      >
        {items}
        {s.overlay !== 'none' && s.theme !== 'contrast' && <div className={`overlay overlay-${s.overlay}`} aria-hidden="true" />}
      </article>
      {s.ruler && <Ruler lead={s.fontSize * s.lineHeight} />}
    </>
  );
}

function useStableOpts(key: string, opts: WordOpts): WordOpts {
  const ref = useRef<{ key: string; opts: WordOpts }>({ key, opts });
  if (ref.current.key !== key) ref.current = { key, opts };
  return ref.current.opts;
}
