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

describe('demo lecture script follows the sample chapter', async () => {
  const { LectureMatcher } = await import('../src/lib/nlp/match');
  const data = new Uint8Array(readFileSync('public/samples/sample-chapter.pdf'));
  const pdf = (await pdfjs.getDocument({ data, verbosity: 0 }).promise) as unknown as PdfDocLike;
  const doc = buildFromPages(await extractPages(pdf));
  const script: { text: string }[] = JSON.parse(readFileSync('public/samples/lecture-script.json', 'utf8'));
  const m = new LectureMatcher(doc.blocks);
  const hits = script.map((l) => {
    const r = m.push(l.text);
    return r ? doc.blocks[r.blockIndex].text : null;
  });

  it('ignores classroom chatter', () => {
    expect(hits[0]).toBeNull();
  });
  it('lands on the paragraph the teacher is explaining', () => {
    expect(hits[3]).toMatch(/^Photosynthesis is the process/);
    expect(hits[7]).toMatch(/^If you look at the underside of a leaf/);
    expect(hits[9]).toMatch(/^Chlorophyll is a green pigment/);
    expect(hits[12]).toMatch(/^Plants absorb water/);
    expect(hits[13]).toMatch(/^Plants lose a large amount of water/);
    expect(hits[14]).toMatch(/^The glucose made in the leaves/);
    expect(hits[16]).toMatch(/^Photosynthesis is the foundation/);
  });
});
