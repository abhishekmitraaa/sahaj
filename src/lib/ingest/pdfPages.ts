import type { PageInput, PageItem } from '../types';

// Minimal structural types so this works with both the browser and Node builds of pdf.js.
interface TextItemLike {
  str: string;
  transform: number[];
  width: number;
  height: number;
}
export interface PdfPageLike {
  getViewport(o: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}
export interface PdfDocLike {
  numPages: number;
  getPage(n: number): Promise<PdfPageLike>;
}

/** Extract positioned text runs from every page (top-left origin). */
export async function extractPages(pdf: PdfDocLike, onPage?: (n: number, total: number) => void): Promise<PageInput[]> {
  const pages: PageInput[] = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const { width, height } = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items: PageItem[] = [];
    for (const raw of content.items) {
      const it = raw as TextItemLike;
      if (typeof it.str !== 'string' || !it.str.trim() || !it.transform) continue;
      const [a, b, , d, e, f] = it.transform;
      const size = Math.hypot(a, b) || Math.abs(d) || it.height || 10;
      items.push({ str: it.str, x: e, y: height - f, w: it.width, size });
    }
    pages.push({ width, height, items });
    onPage?.(n, pdf.numPages);
  }
  return pages;
}
