export type Lang = 'en' | 'hi';
export type BlockType = 'heading' | 'para' | 'list' | 'figure';

/** Character range inside a block's text. */
export interface Span {
  start: number;
  end: number;
}

export interface Block {
  id: string;
  type: BlockType;
  /** Heading level 1–3 (headings only). */
  level?: number;
  text: string;
  page?: number;
  lang: Lang;
  sentences: Span[];
}

export type JunkTag = 'header' | 'footer' | 'page' | 'hyphen' | 'mixed';

/** One line of the document as a naive reader (copy-paste, basic TTS) would see it. */
export interface RawLine {
  text: string;
  tag?: JunkTag;
}

export interface CleanupReport {
  pages: number;
  headersRemoved: number;
  footersRemoved: number;
  pageNumbersRemoved: number;
  hyphenFixes: number;
  linesMerged: number;
  columnPages: number;
  ocrPages: number;
  headingsFound: number;
  figuresFound: number;
  words: number;
  readingGrade: number;
  listenMinutes: number;
}

export type SourceType = 'pdf' | 'docx' | 'text' | 'image' | 'paste' | 'sample';

export interface Doc {
  id: string;
  title: string;
  sourceName: string;
  sourceType: SourceType;
  createdAt: number;
  lang: Lang;
  blocks: Block[];
  raw: RawLine[];
  report: CleanupReport;
}

/** A positioned text run from a PDF page (top-left origin, PDF points). */
export interface PageItem {
  str: string;
  x: number;
  y: number;
  w: number;
  size: number;
}

export interface PageInput {
  width: number;
  height: number;
  items: PageItem[];
}
