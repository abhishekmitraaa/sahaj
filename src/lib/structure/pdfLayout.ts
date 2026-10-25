import type { PageInput, PageItem } from '../types';

export type Zone = 'top' | 'body' | 'bottom';

export interface Line {
  text: string;
  x: number;
  right: number;
  y: number;
  size: number;
  page: number;
  /** 0 = left column, 1 = right column, -1 = spans the page / single column. */
  col: number;
  zone: Zone;
  /** Naive lines only: true when the line mixes text from both columns. */
  mixed?: boolean;
  /** Horizontal extent of each run that makes up the line. */
  runs: [number, number][];
}

export interface PageLayout {
  /** Lines in true reading order (columns read one after another). */
  lines: Line[];
  /** Lines as a naive top-to-bottom reader sees them (columns interleaved). */
  naive: Line[];
  hasColumns: boolean;
}

/** Fraction of page height treated as header / footer territory. */
const MARGIN = 0.08;

function zoneOf(y: number, height: number): Zone {
  if (y < height * MARGIN) return 'top';
  if (y > height * (1 - MARGIN)) return 'bottom';
  return 'body';
}

/** Group positioned runs into visual lines, left to right. */
export function groupLines(items: PageItem[], page: number, height: number, col = -1): Line[] {
  const sorted = items.filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: PageItem[][] = [];
  for (const it of sorted) {
    const g = groups[groups.length - 1];
    if (g) {
      const ref = g[0];
      if (Math.abs(ref.y - it.y) <= Math.max(ref.size, it.size) * 0.45) {
        g.push(it);
        continue;
      }
    }
    groups.push([it]);
  }
  return groups.map((g) => {
    g.sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd = -Infinity;
    for (const it of g) {
      const gap = it.x - prevEnd;
      const needsSpace = text && !text.endsWith(' ') && !it.str.startsWith(' ') && gap > it.size * 0.15;
      text += (needsSpace ? ' ' : '') + it.str;
      prevEnd = it.x + it.w;
    }
    const size = Math.max(...g.map((i) => i.size));
    const y = g[0].y;
    return {
      text: text.replace(/\s+/g, ' ').trim(),
      x: Math.min(...g.map((i) => i.x)),
      right: Math.max(...g.map((i) => i.x + i.w)),
      y,
      size,
      page,
      col,
      zone: zoneOf(y, height),
      runs: g.map((i) => [i.x, i.x + i.w] as [number, number]),
    };
  });
}

/**
 * Find an empty vertical channel in the middle of the page that separates two
 * text columns. Returns the channel's [start, end] in points, or null.
 */
export function findGutter(page: PageInput): [number, number] | null {
  const { width, height } = page;
  const body = page.items.filter(
    (i) => i.str.trim() && i.w < width * 0.55 && zoneOf(i.y, height) === 'body',
  );
  if (body.length < 4) return null;
  const cover = new Uint8Array(Math.ceil(width) + 1);
  for (const it of body) {
    for (let x = Math.max(0, Math.floor(it.x)); x <= Math.min(width, Math.ceil(it.x + it.w)); x++) cover[x] = 1;
  }
  let best: [number, number] | null = null;
  let runStart = -1;
  const lo = Math.floor(width * 0.3);
  const hi = Math.ceil(width * 0.7);
  for (let x = lo; x <= hi + 1; x++) {
    const empty = x <= hi && cover[x] === 0;
    if (empty && runStart < 0) runStart = x;
    if (!empty && runStart >= 0) {
      if (!best || x - runStart > best[1] - best[0]) best = [runStart, x];
      runStart = -1;
    }
  }
  if (!best || best[1] - best[0] < 8) return null;
  const left = body.filter((i) => i.x + i.w <= best![0]).length;
  const right = body.filter((i) => i.x >= best![1]).length;
  return left >= 2 && right >= 2 ? best : null;
}

export function layoutPage(page: PageInput, pageIndex: number): PageLayout {
  const { height } = page;
  const naiveRaw = groupLines(page.items, pageIndex, height);
  const gutter = findGutter(page);
  if (!gutter) return { lines: naiveRaw, naive: naiveRaw, hasColumns: false };

  const [gs, ge] = gutter;
  const mid = (gs + ge) / 2;
  const isSpanning = (i: PageItem) => zoneOf(i.y, height) !== 'body' || (i.x < gs && i.x + i.w > ge);

  // Walk top to bottom; full-width items cut the page into bands, and inside
  // each band the left column is read fully before the right one.
  const sorted = [...page.items].filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: Line[] = [];
  let band: PageItem[] = [];
  let spanRun: PageItem[] = [];
  const flushBand = () => {
    if (!band.length) return;
    const left = band.filter((i) => i.x + i.w / 2 < mid);
    const right = band.filter((i) => i.x + i.w / 2 >= mid);
    lines.push(...groupLines(left, pageIndex, height, 0), ...groupLines(right, pageIndex, height, 1));
    band = [];
  };
  const flushSpan = () => {
    if (!spanRun.length) return;
    lines.push(...groupLines(spanRun, pageIndex, height, -1));
    spanRun = [];
  };
  for (const it of sorted) {
    if (isSpanning(it)) {
      flushBand();
      spanRun.push(it);
    } else {
      flushSpan();
      band.push(it);
    }
  }
  flushBand();
  flushSpan();

  // A naive line is "mixed" when it stitches together runs from both sides of the gutter.
  const naive = naiveRaw.map((l) => ({
    ...l,
    mixed: l.zone === 'body' && l.runs.some(([, r]) => r <= gs + 1) && l.runs.some(([x]) => x >= ge - 1),
  }));
  return { lines, naive, hasColumns: true };
}
