import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPages, type PdfDocLike } from '../src/lib/ingest/pdfPages';
import { buildFromPages } from '../src/lib/structure/build';

describe('sample chapter PDF (real pdf.js extraction)', async () => {
  const data = new Uint8Array(readFileSync('public/samples/sample-chapter.pdf'));
  const pdf = (await pdfjs.getDocument({ data, verbosity: 0 }).promise) as unknown as PdfDocLike;
  const pages = await extractPages(pdf);
  const r = buildFromPages(pages);

  it('rebuilds the chapter structure', () => {
    const headings = r.blocks.filter((b) => b.type === 'heading').map((b) => `${b.level}:${b.text}`);
    expect(headings[0]).toBe('1:Chapter 4: How Plants Make Their Food');
    expect(headings).toContain('2:4.1 What is Photosynthesis?');
    expect(headings).toContain('2:4.6 Why Photosynthesis Matters');
    expect(r.blocks.filter((b) => b.type === 'list')).toHaveLength(4);
    expect(r.blocks.filter((b) => b.type === 'figure')).toHaveLength(1);
  });

  it('removes running heads, feet, page numbers and fixes hyphenation', () => {
    const all = r.blocks.map((b) => b.text).join('\n');
    expect(all).not.toMatch(/Science for Class VII|Sahaj sample chapter/);
    expect(r.report.pageNumbersRemoved).toBe(r.report.pages);
    expect(r.report.hyphenFixes).toBeGreaterThan(0);
    expect(all).not.toMatch(/[a-z]- [a-z]/);
    expect(r.report.columnPages).toBeGreaterThanOrEqual(1);
  });

  it('keeps paragraphs intact across columns', () => {
    const para = r.blocks.find((b) => b.text.startsWith('If you look at the underside'));
    expect(para?.text).toMatch(/oxygen produced during photosynthesis leaves through them\.$/);
    const stomata = r.blocks.find((b) => b.text.includes('These pores are called stomata'));
    expect(stomata).toBeTruthy();
  });
});
