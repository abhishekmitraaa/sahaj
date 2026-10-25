import type { Block, BlockType, CleanupReport, PageInput, RawLine } from '../types';
import { listenMinutes, readability } from '../nlp/readability';
import { layoutPage, type Line } from './pdfLayout';
import { detectLang, splitSentences, wordCount } from './segment';

export const PAGE_NUMBER_RE = /^(?:page\s*)?(?:\d{1,4}|[ivxlcdm]{1,6})(?:\s*(?:of|\/)\s*\d{1,4})?$|^[-–—]\s*\d{1,4}\s*[-–—]$/i;
export const FIGURE_RE = /^(?:fig(?:ure)?\.?|table|diagram|चित्र|तालिका)\s*\d+(?:\.\d+)*\s*[:.\-–—]?/i;
export const LIST_RE = /^\s*(?:[•●▪◦‣\-–*]|\(?(?:\d{1,2}|[a-z])[.)])\s+/i;
const NUMBERED_HEADING_RE = /^(?:chapter\s+\d+|unit\s+\d+|\d+(?:\.\d+){0,3})\s*[.:)]?\s+\S/i;
const TERMINAL_RE = /[.!?:;।]["'”’)]?$/;
const SOFT_HYPHEN_RE = /[A-Za-zऀ-ॿ]-$/;

export interface DraftBlock {
  type: BlockType;
  level?: number;
  text: string;
  page?: number;
}

export interface BuildResult {
  title: string;
  blocks: Block[];
  raw: RawLine[];
  report: CleanupReport;
}

export function emptyReport(): CleanupReport {
  return {
    pages: 1, headersRemoved: 0, footersRemoved: 0, pageNumbersRemoved: 0, hyphenFixes: 0,
    linesMerged: 0, columnPages: 0, ocrPages: 0, headingsFound: 0, figuresFound: 0,
    words: 0, readingGrade: 0, listenMinutes: 0,
  };
}

/** Join two wrapped lines, repairing words split by end-of-line hyphens. */
export function joinLines(a: string, b: string, report?: CleanupReport): string {
  if (!a) return b;
  if (report) report.linesMerged++;
  if (SOFT_HYPHEN_RE.test(a) && /^[a-zऀ-ॿ]/.test(b)) {
    if (report) report.hyphenFixes++;
    return a.slice(0, -1) + b;
  }
  return `${a} ${b}`;
}

/** Assign ids, language and sentence ranges; compute summary stats. */
export function finalize(drafts: DraftBlock[], report: CleanupReport): { blocks: Block[]; title: string } {
  const blocks: Block[] = drafts
    .map((d) => ({ ...d, text: d.text.replace(/\s+/g, ' ').trim() }))
    .filter((d) => d.text)
    .map((d, i) => ({
      id: `b${i}`,
      type: d.type,
      level: d.type === 'heading' ? d.level ?? 2 : undefined,
      text: d.text,
      page: d.page,
      lang: detectLang(d.text),
      sentences: d.type === 'heading' ? [{ start: 0, end: d.text.length }] : splitSentences(d.text),
    }));
  const allText = blocks.filter((b) => b.type !== 'heading').map((b) => b.text).join(' ');
  report.words = wordCount(blocks.map((b) => b.text).join(' '));
  report.readingGrade = readability(allText).grade;
  report.listenMinutes = listenMinutes(report.words);
  report.headingsFound = blocks.filter((b) => b.type === 'heading').length;
  report.figuresFound = blocks.filter((b) => b.type === 'figure').length;
  const title = blocks.find((b) => b.type === 'heading')?.text ?? blocks[0]?.text.slice(0, 60) ?? 'Untitled';
  return { blocks, title };
}

const normKey = (s: string) => s.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim();

function bodyFontSize(lines: Line[]): number {
  const weight = new Map<number, number>();
  for (const l of lines) {
    const k = Math.round(l.size * 2) / 2;
    weight.set(k, (weight.get(k) ?? 0) + l.text.length);
  }
  let best = 12;
  let bestW = -1;
  for (const [k, w] of weight) if (w > bestW) [best, bestW] = [k, w];
  return best;
}

/** Turn positioned PDF text into clean, ordered, structured blocks. */
export function buildFromPages(pages: PageInput[], ocrPages = 0): BuildResult {
  const report = emptyReport();
  report.pages = pages.length;
  report.ocrPages = ocrPages;
  const layouts = pages.map((p, i) => layoutPage(p, i + 1));
  report.columnPages = layouts.filter((l) => l.hasColumns).length;

  // Repeated running heads / feet: same text (digits ignored) in the margin of 2+ pages.
  const keyPages = new Map<string, Set<number>>();
  for (const l of layouts.flatMap((x) => x.lines)) {
    if (l.zone === 'body') continue;
    const k = `${l.zone}|${normKey(l.text)}`;
    if (!keyPages.has(k)) keyPages.set(k, new Set());
    keyPages.get(k)!.add(l.page);
  }
  const repeatThreshold = pages.length >= 2 ? 2 : Infinity;
  const junkKind = (l: Line): 'page' | 'header' | 'footer' | null => {
    if (l.zone === 'body') return null;
    if (PAGE_NUMBER_RE.test(l.text)) return 'page';
    if ((keyPages.get(`${l.zone}|${normKey(l.text)}`)?.size ?? 0) >= repeatThreshold) {
      return l.zone === 'top' ? 'header' : 'footer';
    }
    return null;
  };

  const raw: RawLine[] = [];
  for (const layout of layouts) {
    for (const l of layout.naive) {
      const kind = junkKind(l);
      raw.push({
        text: l.text,
        tag: kind ?? (l.mixed ? 'mixed' : SOFT_HYPHEN_RE.test(l.text) ? 'hyphen' : undefined),
      });
    }
  }

  const lines: Line[] = [];
  for (const l of layouts.flatMap((x) => x.lines)) {
    const kind = junkKind(l);
    if (kind === 'page') report.pageNumbersRemoved++;
    else if (kind === 'header') report.headersRemoved++;
    else if (kind === 'footer') report.footersRemoved++;
    else lines.push(l);
  }

  const body = bodyFontSize(lines);
  const lineGap = body * 1.75;
  const isHeading = (l: Line) =>
    l.text.length < 120 &&
    ((l.size >= body * 1.18 && !/[.;,]$/.test(l.text)) ||
      (NUMBERED_HEADING_RE.test(l.text) && l.size >= body * 1.05 && l.text.length < 90 && !TERMINAL_RE.test(l.text.replace(/[:?]$/, ''))));

  interface Draft extends DraftBlock { last: Line; startX: number; size: number }
  const drafts: Draft[] = [];
  for (const l of lines) {
    const cur = drafts[drafts.length - 1];
    const sameFlow = cur && cur.last.page === l.page && cur.last.col === l.col;
    const gap = sameFlow ? l.y - cur.last.y : Infinity;

    if (isHeading(l)) {
      if (cur?.type === 'heading' && Math.abs(cur.size - l.size) < 0.6 && gap < l.size * 1.8) {
        cur.text = joinLines(cur.text, l.text, report);
        cur.last = l;
      } else drafts.push({ type: 'heading', text: l.text, page: l.page, last: l, startX: l.x, size: l.size });
      continue;
    }
    const kind: BlockType = FIGURE_RE.test(l.text) ? 'figure' : LIST_RE.test(l.text) ? 'list' : 'para';
    let continues = false;
    if (cur && cur.type !== 'heading' && kind === 'para') {
      if (sameFlow) {
        const indented = l.x > cur.last.x + body * 0.9 && TERMINAL_RE.test(cur.last.text);
        continues = gap > 0 && gap <= lineGap && !indented && Math.abs(cur.size - l.size) < 1;
        if (cur.type === 'list') continues = continues && l.x >= cur.startX + body * 0.5;
      } else {
        // Paragraph flowing across a column or page break.
        continues = cur.type === 'para' && (!TERMINAL_RE.test(cur.text) && /^[a-zऀ-ॿ]/.test(l.text) || SOFT_HYPHEN_RE.test(cur.text));
      }
    }
    if (continues) {
      cur.text = joinLines(cur.text, l.text, report);
      cur.last = l;
    } else {
      const text = kind === 'list' ? l.text.replace(LIST_RE, '') : l.text;
      drafts.push({ type: kind, text, page: l.page, last: l, startX: l.x, size: l.size });
    }
  }

  // Heading levels from distinct heading sizes, largest first.
  const sizes = [...new Set(drafts.filter((d) => d.type === 'heading').map((d) => Math.round(d.size)))].sort((a, b) => b - a);
  for (const d of drafts) {
    if (d.type !== 'heading') continue;
    d.level = sizes.length > 1 ? Math.min(3, sizes.indexOf(Math.round(d.size)) + 1) : numberingLevel(d.text);
  }

  const { blocks, title } = finalize(drafts.map(({ type, level, text, page }) => ({ type, level, text, page })), report);
  return { title, blocks, raw, report };
}

function numberingLevel(text: string): number {
  const m = text.match(/^(\d+(?:\.\d+)*)/);
  if (!m) return 2;
  return Math.min(3, m[1].split('.').length);
}

/** Plain text (TXT, Markdown, OCR output, pasted text) → structured blocks. */
export function buildFromText(input: string, ocrPages = 0): BuildResult {
  const report = emptyReport();
  report.ocrPages = ocrPages;
  const text = input.replace(/\r\n?/g, '\n');
  const pages = text.split('\f');
  report.pages = Math.max(1, pages.length);

  const allLines = text.split(/\n|\f/).map((l) => l.trim());
  const counts = new Map<string, number>();
  for (const l of allLines) if (l && l.length < 70) counts.set(normKey(l), (counts.get(normKey(l)) ?? 0) + 1);

  const raw: RawLine[] = [];
  const drafts: DraftBlock[] = [];
  let para = '';
  let paraType: BlockType = 'para';
  const flush = () => {
    if (para.trim()) drafts.push({ type: paraType, text: para });
    para = '';
    paraType = 'para';
  };

  for (const line of allLines) {
    if (!line) {
      raw.push({ text: '' });
      flush();
      continue;
    }
    if (PAGE_NUMBER_RE.test(line)) {
      raw.push({ text: line, tag: 'page' });
      report.pageNumbersRemoved++;
      continue;
    }
    if ((counts.get(normKey(line)) ?? 0) >= 3 && !LIST_RE.test(line)) {
      raw.push({ text: line, tag: 'header' });
      report.headersRemoved++;
      continue;
    }
    raw.push({ text: line, tag: SOFT_HYPHEN_RE.test(line) ? 'hyphen' : undefined });

    const md = line.match(/^(#{1,6})\s+(.*)$/);
    if (md) {
      flush();
      drafts.push({ type: 'heading', level: Math.min(3, md[1].length), text: md[2] });
      continue;
    }
    if (LIST_RE.test(line)) {
      flush();
      para = line.replace(LIST_RE, '');
      paraType = 'list';
      continue;
    }
    if (FIGURE_RE.test(line)) {
      flush();
      para = line;
      paraType = 'figure';
      continue;
    }
    if (!para && looksLikeHeading(line)) {
      drafts.push({ type: 'heading', level: numberingLevel(line), text: line });
      continue;
    }
    para = joinLines(para, line, report);
  }
  flush();

  const headings = drafts.filter((d) => d.type === 'heading');
  if (headings.length && !headings.some((h) => h.level === 1)) headings[0].level = 1;
  const { blocks, title } = finalize(drafts, report);
  return { title, blocks, raw, report };
}

function looksLikeHeading(line: string): boolean {
  if (line.length > 80 || TERMINAL_RE.test(line) || /[,;]$/.test(line)) return false;
  if (NUMBERED_HEADING_RE.test(line)) return true;
  const ws = line.split(/\s+/);
  if (ws.length > 12) return false;
  if (line === line.toUpperCase() && /[A-Z]/.test(line)) return true;
  const capitalised = ws.filter((w) => /^[A-Zऀ-ॿ]/.test(w)).length;
  return ws.length <= 6 && capitalised / ws.length >= 0.6;
}
