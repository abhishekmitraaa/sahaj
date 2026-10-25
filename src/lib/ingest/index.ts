import type { Doc, SourceType } from '../types';
import { buildFromPages, buildFromText, finalize, emptyReport, type BuildResult, type DraftBlock } from '../structure/build';
import { extractPages, type PdfDocLike } from './pdfPages';
import { ocrImage } from './ocr';

export type Progress = (message: string, fraction?: number) => void;

const newId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

function toDoc(r: BuildResult, sourceName: string, sourceType: SourceType): Doc {
  const hi = r.blocks.filter((b) => b.lang === 'hi').length;
  return {
    id: newId(),
    title: r.title,
    sourceName,
    sourceType,
    createdAt: Date.now(),
    lang: hi > r.blocks.length / 2 ? 'hi' : 'en',
    blocks: r.blocks,
    raw: r.raw,
    report: r.report,
  };
}

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

async function ingestPdf(data: ArrayBuffer, name: string, progress: Progress): Promise<Doc> {
  const pdfjs = await loadPdfjs();
  const pdf = await pdfjs.getDocument({ data, verbosity: 0 }).promise;
  progress('Reading pages', 0);
  const pages = await extractPages(pdf as unknown as PdfDocLike, (n, total) => progress(`Reading page ${n} of ${total}`, n / total));

  // Pages with almost no text are probably scans: render and OCR them.
  let ocrPages = 0;
  for (let i = 0; i < pages.length; i++) {
    const chars = pages[i].items.reduce((s, it) => s + it.str.trim().length, 0);
    if (chars > 20) continue;
    progress(`Recognising scanned page ${i + 1}`, i / pages.length);
    const page = await pdf.getPage(i + 1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: canvas.getContext('2d')!, viewport }).promise;
    const text = await ocrImage(canvas, (p) => progress(`Recognising scanned page ${i + 1}`, p));
    // OCR text has no positions; lay it out as one single-column run of lines.
    const lines = text.split('\n').filter((l) => l.trim());
    const { width, height } = pages[i];
    pages[i].items = lines.map((str, k) => ({
      str,
      x: 50,
      y: height * 0.1 + (k * (height * 0.8)) / Math.max(lines.length, 1),
      w: Math.min(width - 100, str.length * 5),
      size: 10,
    }));
    ocrPages++;
  }
  const r = buildFromPages(pages, ocrPages);
  const meta = await pdf.getMetadata().catch(() => null);
  const metaTitle = (meta?.info as { Title?: string } | undefined)?.Title;
  if (metaTitle && !r.blocks.some((b) => b.type === 'heading')) r.title = metaTitle;
  return toDoc(r, name, 'pdf');
}

async function ingestDocx(data: ArrayBuffer, name: string): Promise<Doc> {
  const mammoth = await import('mammoth');
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: data });
  const dom = new DOMParser().parseFromString(html, 'text/html');
  const drafts: DraftBlock[] = [];
  dom.body.querySelectorAll('h1,h2,h3,h4,h5,h6,p,li,caption,figcaption').forEach((el) => {
    const text = el.textContent?.trim() ?? '';
    if (!text) return;
    const tag = el.tagName.toLowerCase();
    if (tag.startsWith('h')) drafts.push({ type: 'heading', level: Math.min(3, Number(tag[1])), text });
    else if (tag === 'li') drafts.push({ type: 'list', text });
    else if (/^(fig(ure)?|table)\.?\s*\d/i.test(text) || tag !== 'p') drafts.push({ type: 'figure', text });
    else drafts.push({ type: 'para', text });
  });
  // Word files without heading styles: fall back to the plain-text heuristics.
  if (!drafts.some((d) => d.type === 'heading')) {
    const plain = drafts.map((d) => d.text).join('\n\n');
    return toDoc(buildFromText(plain), name, 'docx');
  }
  const report = emptyReport();
  const { blocks, title } = finalize(drafts, report);
  return toDoc({ title, blocks, raw: drafts.map((d) => ({ text: d.text })), report }, name, 'docx');
}

export async function ingestFile(file: File, progress: Progress = () => {}): Promise<Doc> {
  const name = file.name;
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (file.type === 'application/pdf' || ext === 'pdf') return ingestPdf(await file.arrayBuffer(), name, progress);
  if (ext === 'docx') {
    progress('Reading Word document');
    return ingestDocx(await file.arrayBuffer(), name);
  }
  if (file.type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'bmp'].includes(ext)) {
    progress('Recognising text in image', 0);
    const text = await ocrImage(file, (p) => progress('Recognising text in image', p));
    const r = buildFromText(text, 1);
    if (!r.blocks.length) throw new Error('No readable text was found in this image. Try a sharper, well-lit photo.');
    return toDoc(r, name, 'image');
  }
  if (['txt', 'md', 'markdown', 'text'].includes(ext) || file.type.startsWith('text/')) {
    return ingestText(await file.text(), name, 'text');
  }
  throw new Error(`Sahaj can open PDF, Word (.docx), text and image files. "${name}" is a .${ext} file.`);
}

export function ingestText(text: string, name = 'Pasted text', type: SourceType = 'paste'): Doc {
  const r = buildFromText(text);
  if (!r.blocks.length) throw new Error('There is no text to read yet. Paste or type some first.');
  return toDoc(r, name, type);
}

export async function ingestUrl(url: string, name: string, progress: Progress = () => {}): Promise<Doc> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${name}.`);
  const blob = await res.blob();
  const doc = await ingestFile(new File([blob], name, { type: blob.type }), progress);
  return { ...doc, sourceType: 'sample' };
}
