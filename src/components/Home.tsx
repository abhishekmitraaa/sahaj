import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ingestFile, ingestText, ingestUrl } from '../lib/ingest';
import { deleteDoc, listLibrary, loadDoc, type LibraryEntry } from '../lib/storage';
import type { Doc } from '../lib/types';
import { useT } from '../i18n';
import { useSettings } from '../state/settings';
import { Icon } from './Icon';

interface Props {
  onOpen: (doc: Doc, isNew: boolean) => void;
}

const FEATURES: { icon: string; en: [string, string]; hi: [string, string] }[] = [
  {
    icon: 'captions',
    en: ['Captions that follow the chapter', 'As your teacher speaks, Sahaj highlights the paragraph they are talking about and saves the lecture as notes filed under each section.'],
    hi: ['अध्याय के साथ चलने वाले कैप्शन', 'शिक्षक के बोलते ही सहज उस अनुच्छेद को चिह्नित करता है और लेक्चर को हर भाग के नीचे नोट्स के रूप में सहेजता है।'],
  },
  {
    icon: 'speaker',
    en: ['Read aloud, word by word', 'A highlighter follows every spoken word. English and Hindi voices, adjustable speed, and it starts wherever you click.'],
    hi: ['शब्द-दर-शब्द पढ़कर सुनाना', 'हर बोले गए शब्द पर हाइलाइटर चलता है। अंग्रेज़ी और हिंदी आवाज़ें, बदलने योग्य गति।'],
  },
  {
    icon: 'wand',
    en: ['Messy PDFs, cleaned', 'Page numbers, running headers and broken words are removed, and two-column pages are read in the right order.'],
    hi: ['उलझे PDF, साफ़', 'पेज नंबर, हेडर और टूटे शब्द हटाए जाते हैं, और दो कॉलम वाले पेज सही क्रम में पढ़े जाते हैं।'],
  },
  {
    icon: 'type',
    en: ['Text that fits your eyes', 'Dyslexia-friendly fonts, spacing, colour overlays, a reading ruler, plain-language rewriting and difficulty marks.'],
    hi: ['आपकी आँखों के अनुकूल टेक्स्ट', 'डिस्लेक्सिया-अनुकूल फ़ॉन्ट, दूरी, रंगीन परत, रूलर, सरल भाषा और कठिनाई के निशान।'],
  },
  {
    icon: 'mic',
    en: ['Hands-free control', 'Say “read”, “slower”, “next section” or “पढ़ो”, “धीरे”. Every action is confirmed out loud and to screen readers.'],
    hi: ['बिना हाथ लगाए नियंत्रण', '“पढ़ो”, “धीरे”, “अगला भाग” बोलें। हर काम की पुष्टि बोलकर और स्क्रीन रीडर को दी जाती है।'],
  },
  {
    icon: 'eye',
    en: ['Private and offline', 'No account and no upload. Your files and notes never leave this device, and Sahaj keeps working without internet.'],
    hi: ['निजी और ऑफ़लाइन', 'न खाता, न अपलोड। आपकी फ़ाइलें और नोट्स इसी डिवाइस पर रहते हैं, और सहज बिना इंटरनेट के भी चलता है।'],
  },
];

export function Home({ onOpen }: Props) {
  const t = useT();
  const lang = useSettings((s) => s.uiLang);
  const [library, setLibrary] = useState<LibraryEntry[]>([]);
  const [busy, setBusy] = useState<{ msg: string; frac?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    listLibrary().then(setLibrary);
  }, []);

  const run = async (fn: () => Promise<Doc>) => {
    setError(null);
    setBusy({ msg: t('working') });
    try {
      onOpen(await fn(), true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };
  const progress = (msg: string, frac?: number) => setBusy({ msg, frac });
  const openFile = (f: File) => run(() => ingestFile(f, progress));

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setOver(false);
    const f = e.dataTransfer.files[0];
    if (f) openFile(f);
  };

  const base = import.meta.env.BASE_URL;
  return (
    <main className="home" id="main" tabIndex={-1}>
      <div className="home-inner">
        <div className="hero">
          <div>
            <h1>
              {lang === 'hi' ? (
                <>पढ़ाई, <span className="stroke">आपके तरीके</span> से।</>
              ) : (
                <>Study material, <span className="stroke">your way</span>.</>
              )}
            </h1>
            <p>{t('heroLead')}</p>
            <div className="hero-actions">
              <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => run(() => ingestUrl(`${base}samples/sample-chapter.pdf`, 'sample-chapter.pdf', progress))}>
                <Icon name="book" /> {t('trySample')}
              </button>
              <button type="button" className="btn" lang="hi" disabled={!!busy} onClick={() => run(() => ingestUrl(`${base}samples/prakash-sanshleshan.txt`, 'प्रकाश-संश्लेषण.txt', progress))}>
                {t('tryHindi')}
              </button>
            </div>
          </div>

          <section
            className={`dropzone${over ? ' is-over' : ''}`}
            aria-labelledby="open-h"
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={onDrop}
          >
            <h2 id="open-h">{over ? t('dropHere') : t('openFile')}</h2>
            <p>{t('dropHint')}</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,image/*,application/pdf"
              className="sr-only"
              id="file-input"
              aria-label={t('openFile')}
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) openFile(f);
                e.target.value = '';
              }}
            />
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> {t('openFile')}
            </button>
            {busy && (
              <div className="progress" role="status">
                <span>{busy.msg}</span>
                <div className="progress-bar" aria-hidden="true">
                  <span style={{ width: `${Math.round((busy.frac ?? 0.15) * 100)}%` }} />
                </div>
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                <strong>{t('errorTitle')}</strong>
                {error}
              </div>
            )}
            <div className="paste">
              <label htmlFor="paste-input" style={{ fontWeight: 700 }}>{t('pasteLabel')}</label>
              <textarea id="paste-input" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={t('pastePlaceholder')} />
              <div>
                <button type="button" className="btn" disabled={!paste.trim() || !!busy} onClick={() => run(async () => ingestText(paste))}>
                  {t('readPasted')}
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="home-section" aria-labelledby="lib-h">
          <h2 id="lib-h">{t('library')}</h2>
          {!library.length ? (
            <p className="muted">{t('libraryEmpty')}</p>
          ) : (
            <ul className="library">
              {library.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    className="library-open"
                    onClick={async () => {
                      const doc = await loadDoc(e.id);
                      if (doc) onOpen(doc, false);
                    }}
                  >
                    <strong lang={e.lang}>{e.title}</strong>
                    <span>
                      {e.words} {t('words')}, {new Date(e.createdAt).toLocaleDateString()}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon"
                    aria-label={`${t('remove')}: ${e.title}`}
                    onClick={async () => {
                      await deleteDoc(e.id);
                      setLibrary(await listLibrary());
                    }}
                  >
                    <Icon name="close" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="home-section" aria-label="Features">
          <ul className="features">
            {FEATURES.map((f) => (
              <li key={f.icon}>
                <h3>
                  <Icon name={f.icon} />
                  {f[lang][0]}
                </h3>
                <p>{f[lang][1]}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
