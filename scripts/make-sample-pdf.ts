// Generates public/samples/sample-chapter.pdf: a deliberately "typical" school
// PDF with two columns, running heads, page numbers and hyphenated line breaks,
// so the Clean-Read pipeline has real problems to fix in the demo.
import { writeFileSync, mkdirSync } from 'node:fs';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { splitSyllables } from '../src/lib/nlp/syllables';
import { LECTURE_SCRIPT, RUNNING_FOOT, RUNNING_HEAD, SAMPLE_FLOW, SAMPLE_TITLE } from './sample-content';

const W = 595;
const H = 842;
const MARGIN_X = 50;
const GUTTER = 26;
const COL_W = (W - MARGIN_X * 2 - GUTTER) / 2;
const TOP = 90;
const BOTTOM = H - 80;
const BODY = 10.5;
const LEAD = 15;

const doc = await PDFDocument.create();
doc.setTitle(SAMPLE_TITLE);
const regular = await doc.embedFont(StandardFonts.TimesRoman);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);
const italic = await doc.embedFont(StandardFonts.TimesRomanItalic);
const small = await doc.embedFont(StandardFonts.Helvetica);

let page: PDFPage;
let pageNo = 0;
let col = 0;
let y = 0; // distance from top
let colTop = TOP;

function newPage() {
  page = doc.addPage([W, H]);
  pageNo++;
  col = 0;
  y = TOP;
  colTop = TOP;
  page.drawText(RUNNING_HEAD, { x: MARGIN_X, y: H - 40, size: 9, font: small, color: rgb(0.35, 0.35, 0.35) });
  page.drawLine({ start: { x: MARGIN_X, y: H - 48 }, end: { x: W - MARGIN_X, y: H - 48 }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
  page.drawText(RUNNING_FOOT, { x: MARGIN_X, y: 48, size: 8, font: small, color: rgb(0.4, 0.4, 0.4) });
  const num = String(pageNo);
  page.drawText(num, { x: W / 2 - small.widthOfTextAtSize(num, 9) / 2, y: 32, size: 9, font: small });
}

const colX = () => MARGIN_X + col * (COL_W + GUTTER);

function ensureSpace(h: number) {
  if (y + h <= BOTTOM) return;
  if (col === 0) {
    col = 1;
    y = colTop;
  } else newPage();
}

/** Greedy line wrap with syllable-based hyphenation, like a typesetter would. */
function wrap(text: string, font: PDFFont, size: number, width: number, indent = 0): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  let avail = width - indent;
  const fits = (s: string) => font.widthOfTextAtSize(s, size) <= avail;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    const candidate = line ? `${line} ${w}` : w;
    if (fits(candidate)) {
      line = candidate;
      continue;
    }
    // Try to hyphenate long words across the line break.
    const sylls = splitSyllables(w.replace(/[^A-Za-z]+$/, ''));
    let placed = false;
    if (sylls.length > 1 && line) {
      for (let k = sylls.length - 1; k >= 1; k--) {
        const head = sylls.slice(0, k).join('');
        if (head.length >= 3 && fits(`${line} ${head}-`)) {
          lines.push(`${line} ${head}-`);
          line = w.slice(head.length);
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      if (line) lines.push(line);
      line = w;
    }
    avail = width;
  }
  if (line) lines.push(line);
  return lines;
}

newPage();

for (const el of SAMPLE_FLOW) {
  if (el.kind === 'title') {
    page!.drawText(el.text, { x: MARGIN_X, y: H - 82, size: 20, font: bold, color: rgb(0.1, 0.16, 0.3) });
    y = 112;
    colTop = 112;
    continue;
  }
  if (el.kind === 'heading') {
    ensureSpace(LEAD * 4);
    y += 10;
    for (const l of wrap(el.text, bold, 13, COL_W)) {
      page!.drawText(l, { x: colX(), y: H - y, size: 13, font: bold, color: rgb(0.1, 0.16, 0.3) });
      y += 18;
    }
    y += 2;
    continue;
  }
  if (el.kind === 'figure') {
    const boxH = 110;
    ensureSpace(boxH + 40);
    const x = colX();
    page!.drawRectangle({ x, y: H - y - boxH, width: COL_W, height: boxH, borderColor: rgb(0.5, 0.6, 0.5), borderWidth: 1, color: rgb(0.93, 0.97, 0.93) });
    // A simple leaf outline so the page has a picture with no text alternative.
    page!.drawEllipse({ x: x + COL_W / 2, y: H - y - boxH / 2, xScale: COL_W / 2.6, yScale: boxH / 3.2, color: rgb(0.55, 0.78, 0.5) });
    page!.drawLine({ start: { x: x + 25, y: H - y - boxH / 2 }, end: { x: x + COL_W - 25, y: H - y - boxH / 2 }, thickness: 1.5, color: rgb(0.3, 0.5, 0.3) });
    y += boxH + 14;
    for (const l of wrap(el.caption, italic, 9.5, COL_W)) {
      page!.drawText(l, { x, y: H - y, size: 9.5, font: italic });
      y += 13;
    }
    y += 8;
    continue;
  }
  if (el.kind === 'list') {
    for (const item of el.items) {
      const lines = wrap(item, regular, BODY, COL_W - 14);
      lines.forEach((l, i) => {
        ensureSpace(LEAD);
        if (i === 0) page!.drawText('•', { x: colX() + 2, y: H - y, size: BODY, font: regular });
        page!.drawText(l, { x: colX() + 14, y: H - y, size: BODY, font: regular });
        y += LEAD;
      });
      y += 3;
    }
    y += 6;
    continue;
  }
  const lines = wrap(el.text, regular, BODY, COL_W, 12);
  lines.forEach((l, i) => {
    ensureSpace(LEAD);
    page!.drawText(l, { x: colX() + (i === 0 ? 12 : 0), y: H - y, size: BODY, font: regular });
    y += LEAD;
  });
  y += 8;
}

mkdirSync('public/samples', { recursive: true });
writeFileSync('public/samples/sample-chapter.pdf', await doc.save());
writeFileSync('public/samples/lecture-script.json', JSON.stringify(LECTURE_SCRIPT, null, 2));
console.log(`sample-chapter.pdf: ${pageNo} pages`);
