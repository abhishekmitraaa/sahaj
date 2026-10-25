import { get, set, del } from 'idb-keyval';
import type { Doc } from './types';

// Everything stays in this browser's IndexedDB. Failures (private mode,
// blocked storage) are swallowed: the app keeps working, it just won't remember.

export interface LibraryEntry {
  id: string;
  title: string;
  sourceName: string;
  createdAt: number;
  words: number;
  lang: Doc['lang'];
}

export interface Caption {
  id: string;
  /** Milliseconds since the lecture started. */
  t: number;
  text: string;
  blockId: string | null;
  section: string | null;
}

export interface Position {
  b: number;
  s: number;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

export const listLibrary = () => safe(async () => (await get<LibraryEntry[]>('library')) ?? [], []);

export async function saveDoc(doc: Doc) {
  await safe(async () => {
    await set(`doc:${doc.id}`, doc);
    const lib = (await get<LibraryEntry[]>('library')) ?? [];
    const entry: LibraryEntry = {
      id: doc.id, title: doc.title, sourceName: doc.sourceName, createdAt: doc.createdAt,
      words: doc.report.words, lang: doc.lang,
    };
    await set('library', [entry, ...lib.filter((e) => e.id !== doc.id)].slice(0, 50));
  }, undefined);
}

export const loadDoc = (id: string) => safe(() => get<Doc>(`doc:${id}`), undefined);

export async function deleteDoc(id: string) {
  await safe(async () => {
    await Promise.all([del(`doc:${id}`), del(`pos:${id}`), del(`notes:${id}`)]);
    const lib = (await get<LibraryEntry[]>('library')) ?? [];
    await set('library', lib.filter((e) => e.id !== id));
  }, undefined);
}

export const savePosition = (id: string, pos: Position) => safe(() => set(`pos:${id}`, pos), undefined);
export const loadPosition = (id: string) => safe(() => get<Position>(`pos:${id}`), undefined);
export const saveNotes = (id: string, notes: Caption[]) => safe(() => set(`notes:${id}`, notes), undefined);
export const loadNotes = (id: string) => safe(async () => (await get<Caption[]>(`notes:${id}`)) ?? [], []);
