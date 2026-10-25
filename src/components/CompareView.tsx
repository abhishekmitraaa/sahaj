import type { Doc, JunkTag } from '../lib/types';
import { useApp } from '../state/app';
import { useT, type StringKey } from '../i18n';
import { Icon } from './Icon';

const LEGEND: [JunkTag, StringKey][] = [
  ['header', 'legendHeader'],
  ['page', 'legendPage'],
  ['hyphen', 'legendHyphen'],
  ['mixed', 'legendMixed'],
];

const TAG_LABEL: Record<JunkTag, string> = {
  header: 'removed header',
  footer: 'removed footer',
  page: 'removed page number',
  hyphen: 'broken word',
  mixed: 'columns mixed',
};

/** Side-by-side: what a naive reader gets from the file vs. what Sahaj rebuilt. */
export function CompareView({ doc }: { doc: Doc }) {
  const t = useT();
  const close = () => useApp.getState().set({ compare: false });
  const r = doc.report;
  const fixed = r.headersRemoved + r.footersRemoved + r.pageNumbersRemoved + r.hyphenFixes;
  return (
    <main className="compare" id="main" tabIndex={-1}>
      <div className="compare-head">
        <div>
          <h1>{t('compareTitle')}</h1>
          <ul className="legend">
            {LEGEND.map(([tag, key]) => (
              <li key={tag}>
                <span className={`swatch-sm tag-${tag}`} aria-hidden="true" /> {t(key)}
              </li>
            ))}
          </ul>
        </div>
        <button type="button" className="btn btn-primary" onClick={close}>
          <Icon name="book" /> {t('backToReading')}
        </button>
      </div>
      <div className="compare-cols">
        <section className="compare-col" aria-labelledby="before-h">
          <h2 id="before-h">{t('beforeTitle')}</h2>
          <pre className="raw">
            {doc.raw.map((l, i) =>
              l.tag ? (
                <span key={i}>
                  <mark className={`tag-${l.tag}`}>
                    <span className="sr-only">[{TAG_LABEL[l.tag]}] </span>
                    {l.text}
                  </mark>
                  {'\n'}
                </span>
              ) : (
                <span key={i}>{l.text}{'\n'}</span>
              ),
            )}
          </pre>
        </section>
        <section className="compare-col clean" aria-labelledby="after-h">
          <h2 id="after-h">
            {t('afterTitle')} <span className="muted" style={{ fontWeight: 400 }}>({fixed} fixes, {r.headingsFound} {t('headings').toLowerCase()})</span>
          </h2>
          {doc.blocks.map((b) => {
            if (b.type === 'heading') {
              const H = `h${Math.min(3, b.level ?? 2)}` as 'h1' | 'h2' | 'h3';
              return <H key={b.id} lang={b.lang}>{b.text}</H>;
            }
            if (b.type === 'list') return <p key={b.id} lang={b.lang} style={{ marginLeft: '1.2em' }}>• {b.text}</p>;
            if (b.type === 'figure') return <p key={b.id} lang={b.lang}><em>{b.text}</em></p>;
            return <p key={b.id} lang={b.lang}>{b.text}</p>;
          })}
        </section>
      </div>
    </main>
  );
}
